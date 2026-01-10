/**
 * electricianController.js - 完整版
 * 包含所有电工相关功能
 * 2026.1.10新增：查询提现状态
 */

const { Order, Payment, Review, User, ElectricianCertification, Withdrawal, sequelize } = require('../models');
const AppError = require('../utils/AppError');
const WechatPayV3Service = require('../utils/WechatPayV3Service');
const { Op } = require('sequelize');
const crypto = require('crypto');

/**
 * 提交电工认证申请
 */
exports.submitCertification = async (req, res, next) => {
  try {
    const userId = req.user.id;
    const {
      work_types,
      real_name,
      id_card,
      electrician_cert_no,
      cert_start_date,
      cert_end_date
    } = req.body;

    let certification = await ElectricianCertification.findOne({
      where: { user_id: userId }
    });

    if (certification) {
      if (certification.status === 'pending') {
        throw new AppError('您的认证申请正在审核中，请勿重复提交', 400);
      }
      if (certification.status === 'approved') {
        throw new AppError('您已通过电工认证，无需重复申请', 400);
      }
      // 被拒绝的可以重新提交
      await certification.update({
        work_types,
        real_name,
        id_card,
        electrician_cert_no,
        cert_start_date,
        cert_end_date,
        status: 'pending',
        reject_reason: null
      });
    } else {
      certification = await ElectricianCertification.create({
        user_id: userId,
        work_types,
        real_name,
        id_card,
        electrician_cert_no,
        cert_start_date,
        cert_end_date,
        status: 'pending'
      });
    }

    res.status(201).json({
      success: true,
      message: '认证申请已提交，请等待审核',
      data: certification
    });
  } catch (error) {
    next(error);
  }
};

/**
 * 获取电工认证状态
 */
exports.getCertificationStatus = async (req, res, next) => {
  try {
    const userId = req.user.id;
    const certification = await ElectricianCertification.findOne({
      where: { user_id: userId }
    });

    res.status(200).json({
      success: true,
      data: certification || { status: 'none' }
    });
  } catch (error) {
    next(error);
  }
};

/**
 * ⭐ 修复：计算电工收入余额（公共函数）
 * 分别计算：总收入、已提现、锁定中（处理中）、可用余额
 */
async function calculateBalance(electricianId, transaction = null) {
  // 1. 计算总收入（5星好评的已完成订单）
  const eligibleOrders = await Order.findAll({
    where: {
      electrician_id: electricianId,
      status: 'completed'
    },
    include: [{
      model: Review,
      as: 'review',
      where: { rating: 5 },
      attributes: [],
      required: true
    }],
    attributes: ['id'],
    transaction
  });

  const orderIds = eligibleOrders.map(order => order.id);

  let totalIncome = 0;
  if (orderIds.length > 0) {
    const incomeResult = await Payment.sum('amount', {
      where: {
        order_id: { [Op.in]: orderIds },
        status: 'success',
        type: { [Op.in]: ['prepay', 'repair'] }
      },
      transaction
    });
    totalIncome = incomeResult || 0;
  }

  // 2. ⭐ 修复：只计算成功的提现作为已提现金额
  const successWithdrawn = await Withdrawal.sum('amount', {
    where: {
      electrician_id: electricianId,
      status: 'success'
    },
    transaction
  });
  const withdrawnAmount = successWithdrawn || 0;

  // 3. ⭐ 新增：计算处理中的提现作为锁定金额
  const processingWithdrawn = await Withdrawal.sum('amount', {
    where: {
      electrician_id: electricianId,
      status: 'processing'
    },
    transaction
  });
  const lockedAmount = processingWithdrawn || 0;

  // 4. ⭐ 修复：可用余额 = 总收入 - 已提现 - 锁定中
  const availableBalance = Number((totalIncome - withdrawnAmount - lockedAmount).toFixed(2));

  return {
    totalIncome: Number(totalIncome.toFixed(2)),
    withdrawnAmount: Number(withdrawnAmount.toFixed(2)),
    lockedAmount: Number(lockedAmount.toFixed(2)),
    availableBalance
  };
}

/**
 * 获取电工收入详情
 */
exports.getIncome = async (req, res, next) => {
  try {
    const electricianId = req.user.id;
    
    const balance = await calculateBalance(electricianId);

    res.status(200).json({
      success: true,
      data: {
        total_income: balance.totalIncome,
        withdrawn_amount: balance.withdrawnAmount,
        locked_amount: balance.lockedAmount, // ⭐ 新增：处理中的金额
        available_balance: balance.availableBalance
      }
    });
  } catch (error) {
    next(error);
  }
};

/**
 * 生成唯一的商户订单号
 */
function generateOutBatchNo(electricianId) {
  const timestamp = Date.now();
  const random = crypto.randomBytes(4).toString('hex');
  return `W${timestamp}${electricianId}${random}`.substring(0, 32);
}

/**
 * 申请提现
 */
exports.withdraw = async (req, res, next) => {
  const t = await sequelize.transaction();
  
  try {
    const electricianId = req.user.id;
    const { amount } = req.body;

    // 1. ⭐ 修复：检查是否有处理中的提现（不限时间）
    const processingWithdrawal = await Withdrawal.findOne({
      where: {
        electrician_id: electricianId,
        status: 'processing'
      },
      transaction: t
    });

    if (processingWithdrawal) {
      throw new AppError('您有提现申请正在处理中，请等待处理完成后再试', 400);
    }

    // 2. 获取用户信息
    const user = await User.findByPk(electricianId, {
      attributes: ['id', 'openid'],
      transaction: t
    });

    if (!user || !user.openid) {
      throw new AppError('用户未绑定微信，无法提现', 400);
    }

    // 3. 获取实名信息
    const certification = await ElectricianCertification.findOne({
      where: { 
        user_id: electricianId,
        status: 'approved'
      },
      attributes: ['real_name'],
      transaction: t
    });

    if (!certification || !certification.real_name) {
      throw new AppError('请先完成实名认证', 400);
    }

    // 4. 计算可提现余额
    const balance = await calculateBalance(electricianId, t);

    const withdrawAmount = amount ? Number(amount) : balance.availableBalance;

    // 5. ⭐ 统一最低提现金额为 0.1 元（测试阶段）
    if (withdrawAmount < 0.1) {
      throw new AppError('提现金额不能低于0.10元', 400);
    }

    if (withdrawAmount > balance.availableBalance) {
      throw new AppError(`余额不足，可用余额：¥${balance.availableBalance}`, 400);
    }

    // 6. 生成唯一订单号并创建提现记录
    const outBatchNo = generateOutBatchNo(electricianId);
    
    console.log(`[提现] 电工ID: ${electricianId}, 金额: ${withdrawAmount}, 订单号: ${outBatchNo}`);
    console.log(`[提现] 余额快照:`, {
      totalIncome: balance.totalIncome,
      withdrawnAmount: balance.withdrawnAmount,
      lockedAmount: balance.lockedAmount,
      availableBalance: balance.availableBalance
    });
    
    const withdrawal = await Withdrawal.create({
      electrician_id: electricianId,
      amount: withdrawAmount,
      status: 'pending',
      out_batch_no: outBatchNo,
      openid: user.openid,
      real_name: certification.real_name,
      total_income_snapshot: balance.totalIncome,
      withdrawn_snapshot: balance.withdrawnAmount,
      available_balance_snapshot: balance.availableBalance
    }, { transaction: t });

    // 7. 提交事务
    await t.commit();
    console.log(`[提现] 订单已创建: ${withdrawal.id}`);

    // 8. 调用微信转账API
    let transferResult = null;
    try {
      const wechatPayService = new WechatPayV3Service();
      
      const transferParams = {
        out_bill_no: outBatchNo,
        transfer_scene_id: '1005',
        openid: user.openid,
        user_name: certification.real_name,
        transfer_amount: withdrawAmount, // 单位：元
        transfer_remark: '电工收入提现',
        user_recv_perception: '劳务报酬',
        transfer_scene_report_infos: [
          {
            info_type: '岗位类型',
            info_content: '电工'
          },
          {
            info_type: '报酬说明',
            info_content: '维修安装服务费'
          }
        ]
      };

      console.log(`[提现] 调用微信API: ${outBatchNo}`);
      transferResult = await wechatPayService.createTransferBill(transferParams);
      console.log(`[提现] 微信API返回:`, transferResult);

      // 9. 更新提现状态
      await Withdrawal.update({
        status: 'processing',
        transfer_bill_no: transferResult.transfer_bill_no || transferResult.out_bill_no,
        package_info: transferResult.package_info
      }, {
        where: { id: withdrawal.id }
      });

      console.log(`[提现] 状态已更新为processing: ${withdrawal.id}`);

      // 10. 返回成功响应
      res.status(200).json({
        success: true,
        message: '提现申请已提交，请确认收款',
        data: {
          withdrawal_id: withdrawal.id,
          amount: withdrawAmount,
          status: 'processing',
          out_batch_no: outBatchNo,
          transfer_bill_no: transferResult.transfer_bill_no,
          package_info: transferResult.package_info,
          state: transferResult.state || 'WAIT_USER_CONFIRM'
        }
      });

    } catch (apiError) {
      console.error('[提现] 微信API错误:', apiError);
      
      // 处理频率限制
      if (apiError.status === 429 || apiError.code === 'FREQUENCY_LIMIT_EXCEED') {
        await Withdrawal.update({
          status: 'failed',
          fail_reason: '请求过于频繁，请稍后再试'
        }, {
          where: { id: withdrawal.id }
        });
        
        throw new AppError('提现请求过于频繁，请5分钟后再试', 429);
      }

      // 其他错误
      await Withdrawal.update({
        status: 'failed',
        fail_reason: apiError.message || '微信转账接口调用失败'
      }, {
        where: { id: withdrawal.id }
      });

      throw new AppError(`提现申请失败：${apiError.message}`, 500);
    }

  } catch (error) {
    // 只有当事务还未完成时才回滚
    if (!t.finished) {
      try {
        await t.rollback();
      } catch (rollbackError) {
        console.error('[提现] 事务回滚失败:', rollbackError);
      }
    }
    
    // 特殊处理429错误
    if (error.statusCode === 429) {
      return res.status(429).json({
        success: false,
        message: error.message,
        code: 'RATE_LIMIT_EXCEEDED'
      });
    }
    
    next(error);
  }
};

/**
 * 获取提现记录列表
 */
exports.getWithdrawals = async (req, res, next) => {
  try {
    const electricianId = req.user.id;
    const { page = 1, pageSize = 20, status } = req.query;

    const where = { electrician_id: electricianId };
    if (status) {
      where.status = status;
    }

    const { rows: withdrawals, count: total } = await Withdrawal.findAndCountAll({
      where,
      attributes: [
        'id',
        'amount',
        'status',
        'out_batch_no',
        'fail_reason',
        'created_at',
        'completed_at'
      ],
      order: [['created_at', 'DESC']],
      limit: parseInt(pageSize),
      offset: (parseInt(page) - 1) * parseInt(pageSize)
    });

    res.status(200).json({
      success: true,
      data: {
        list: withdrawals,
        pagination: {
          page: parseInt(page),
          pageSize: parseInt(pageSize),
          total,
          totalPages: Math.ceil(total / pageSize)
        }
      }
    });
  } catch (error) {
    next(error);
  }
};

/**
 * ⭐ 查询转账单状态
 * 用于确认用户确认/取消后的最终状态
 */
exports.queryWithdrawalStatus = async (req, res, next) => {
  try {
    const electricianId = req.user.id;
    const { withdrawal_id, out_batch_no } = req.query;

    // 1. 查询本地订单
    const where = { electrician_id: electricianId };
    if (withdrawal_id) {
      where.id = withdrawal_id;
    } else if (out_batch_no) {
      where.out_batch_no = out_batch_no;
    } else {
      throw new AppError('缺少查询参数', 400);
    }

    const withdrawal = await Withdrawal.findOne({ where });
    
    if (!withdrawal) {
      throw new AppError('提现记录不存在', 404);
    }

    console.log(`[查询状态] 订单ID: ${withdrawal.id}, 当前状态: ${withdrawal.status}`);

    // 2. 如果已经是终态，直接返回
    if (['success', 'failed', 'cancelled'].includes(withdrawal.status)) {
      console.log(`[查询状态] 已是终态: ${withdrawal.status}`);
      return res.status(200).json({
        success: true,
        data: {
          id: withdrawal.id,
          amount: withdrawal.amount,
          status: withdrawal.status,
          out_batch_no: withdrawal.out_batch_no,
          transfer_bill_no: withdrawal.transfer_bill_no,
          fail_reason: withdrawal.fail_reason,
          created_at: withdrawal.created_at,
          completed_at: withdrawal.completed_at
        }
      });
    }

    // 3. ⭐ 调用微信API查询转账单状态
    try {
      const wechatPayService = new WechatPayV3Service();
      const queryResult = await wechatPayService.queryTransferBill(withdrawal.out_batch_no);
      
      console.log(`[查询状态] 微信返回:`, queryResult);

      // 4. 根据微信返回的状态更新本地订单
      const updateData = {};
      
      if (queryResult.state === 'SUCCESS') {
        updateData.status = 'success';
        updateData.completed_at = new Date();
        console.log(`[查询状态] 更新为成功`);
      } else if (queryResult.state === 'FAIL') {
        updateData.status = 'failed';
        updateData.fail_reason = queryResult.fail_reason || '转账失败';
        console.log(`[查询状态] 更新为失败: ${updateData.fail_reason}`);
      } else if (queryResult.state === 'CANCELLED') {
        updateData.status = 'cancelled';
        updateData.fail_reason = '用户取消';
        console.log(`[查询状态] 更新为已取消`);
      } else if (queryResult.state === 'PROCESSING' || queryResult.state === 'WAIT_USER_CONFIRM') {
        // 仍在处理中，不更新状态
        console.log(`[查询状态] 仍在处理中: ${queryResult.state}`);
      }

      // 5. 更新数据库
      if (Object.keys(updateData).length > 0) {
        await Withdrawal.update(updateData, {
          where: { id: withdrawal.id }
        });
        console.log(`[查询状态] 订单状态已更新:`, updateData);
      }

      // 6. 返回最新状态
      const updatedWithdrawal = await Withdrawal.findByPk(withdrawal.id);
      
      res.status(200).json({
        success: true,
        data: {
          id: updatedWithdrawal.id,
          amount: updatedWithdrawal.amount,
          status: updatedWithdrawal.status,
          out_batch_no: updatedWithdrawal.out_batch_no,
          transfer_bill_no: updatedWithdrawal.transfer_bill_no,
          fail_reason: updatedWithdrawal.fail_reason,
          created_at: updatedWithdrawal.created_at,
          completed_at: updatedWithdrawal.completed_at,
          wechat_state: queryResult.state // 微信返回的原始状态
        }
      });

    } catch (apiError) {
      console.error('[查询状态] 微信API错误:', apiError);
      
      // API调用失败，返回本地状态
      res.status(200).json({
        success: true,
        data: {
          id: withdrawal.id,
          amount: withdrawal.amount,
          status: withdrawal.status,
          out_batch_no: withdrawal.out_batch_no,
          transfer_bill_no: withdrawal.transfer_bill_no,
          fail_reason: withdrawal.fail_reason,
          created_at: withdrawal.created_at,
          completed_at: withdrawal.completed_at,
          query_error: apiError.message
        }
      });
    }

  } catch (error) {
    next(error);
  }
};

/**
 * 提现回调处理（微信异步通知）
 */
exports.withdrawalCallback = async (req, res, next) => {
  try {
    const wechatPayService = new WechatPayV3Service();
    
    // 验证签名
    const result = await wechatPayService.handlePaymentNotify(req.headers, req.body);
    
    if (!result.success) {
      throw new AppError('签名验证失败', 400);
    }

    const { out_bill_no } = result.decrypted_data || {};
    const transferState = result.decrypted_data?.state || result.decrypted_data?.transfer_state;

    console.log(`[提现回调] 收到回调: ${out_bill_no}, 状态: ${transferState}`);

    // ⭐ 收到回调后，主动查询确认状态
    if (out_bill_no) {
      try {
        const queryResult = await wechatPayService.queryTransferBill(out_bill_no);
        
        const updateData = {};
        
        if (queryResult.state === 'SUCCESS') {
          updateData.status = 'success';
          updateData.completed_at = new Date();
        } else if (queryResult.state === 'FAIL') {
          updateData.status = 'failed';
          updateData.fail_reason = queryResult.fail_reason || '转账失败';
        } else if (queryResult.state === 'CANCELLED') {
          updateData.status = 'cancelled';
          updateData.fail_reason = '用户取消';
        }

        if (Object.keys(updateData).length > 0) {
          await Withdrawal.update(updateData, {
            where: { out_batch_no: out_bill_no }
          });
          console.log(`[提现回调] 状态已更新:`, updateData);
        }
      } catch (queryError) {
        console.error('[提现回调] 查询状态失败:', queryError);
      }
    }

    res.status(200).json({ code: 'SUCCESS', message: '成功' });
  } catch (error) {
    console.error('Withdrawal callback error:', error);
    res.status(500).json({ code: 'FAIL', message: error.message });
  }
};

module.exports = exports;