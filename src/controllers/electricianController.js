const { Order, Payment, Review, User, ElectricianCertification, Withdrawal, sequelize } = require('../models');
const AppError = require('../utils/AppError');
const WechatPayV3Service = require('../utils/WechatPayV3Service');
const { Op } = require('sequelize');

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
 * 计算电工收入余额（提取为公共函数）
 * @param {number} electricianId 
 * @param {object} transaction Sequelize事务对象（可选）
 * @returns {Promise<{totalIncome: number, withdrawnAmount: number, availableBalance: number}>}
 */
async function calculateBalance(electricianId, transaction = null) {
  // 1. 获取符合条件的订单ID（已完成 + 5星好评）
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
      required: true  // INNER JOIN
    }],
    attributes: ['id'],
    transaction
  });

  const orderIds = eligibleOrders.map(order => order.id);

  // 2. 计算总收入（预付款 + 维修费）
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

  // 3. 计算已提现金额（成功 + 处理中）
  const withdrawnResult = await Withdrawal.sum('amount', {
    where: {
      electrician_id: electricianId,
      status: { [Op.in]: ['success', 'processing'] }
    },
    transaction
  });
  const withdrawnAmount = withdrawnResult || 0;

  // 4. 计算可提现余额
  const availableBalance = Number((totalIncome - withdrawnAmount).toFixed(2));

  return {
    totalIncome: Number(totalIncome.toFixed(2)),
    withdrawnAmount: Number(withdrawnAmount.toFixed(2)),
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
        available_balance: balance.availableBalance
      }
    });
  } catch (error) {
    next(error);
  }
};

/**
 * 申请提现
 */
exports.withdraw = async (req, res, next) => {
  const t = await sequelize.transaction();
  
  try {
    const electricianId = req.user.id;
    const { amount } = req.body;

    // 1. 获取用户信息
    const user = await User.findByPk(electricianId, {
      attributes: ['id', 'openid'],
      transaction: t
    });

    if (!user || !user.openid) {
      throw new AppError('用户未绑定微信，无法提现', 400);
    }

    // 2. 获取实名信息（用于微信转账校验）
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

    // 3. 计算可提现余额（加事务锁）
    const balance = await calculateBalance(electricianId, t);

    // 确定提现金额
    const withdrawAmount = amount ? Number(amount) : balance.availableBalance;

    // 验证金额
    if (withdrawAmount < 0.2) {
      throw new AppError('提现金额不能低于0.20元', 400);
    }

    if (withdrawAmount > balance.availableBalance) {
      throw new AppError(`余额不足，可用余额：¥${balance.availableBalance}`, 400);
    }

    // 4. 创建提现记录
    const outBatchNo = `W${Date.now()}${electricianId}`;
    
    const withdrawal = await Withdrawal.create({
      electrician_id: electricianId,
      amount: withdrawAmount,
      status: 'pending',
      out_batch_no: outBatchNo,
      openid: user.openid,
      real_name: certification.real_name,
      // 保存余额快照（重要：用于对账）
      total_income_snapshot: balance.totalIncome,
      withdrawn_snapshot: balance.withdrawnAmount,
      available_balance_snapshot: balance.availableBalance
    }, { transaction: t });

    // 提交事务（释放锁，避免阻塞微信API调用）
    await t.commit();

    // 5. 调用微信转账API（事务外执行，避免长时间锁表）
    let transferResult = null;
    try {
      const wechatPayService = new WechatPayV3Service();
      
      const transferParams = {
        out_bill_no: outBatchNo,
        transfer_scene_id: '1005', // 劳务报酬
        openid: user.openid,
        user_name: certification.real_name, // 需加密，WechatPayV3Service内部处理
        transfer_amount: Math.round(withdrawAmount * 100), // 转为分
        transfer_remark: '电工收入提现'
      };

      transferResult = await wechatPayService.createTransferBill(transferParams);

      // 6. 更新提现状态为处理中
      await Withdrawal.update({
        status: 'processing',
        transfer_bill_no: transferResult.transfer_bill_no || transferResult.out_bill_no
      }, {
        where: { id: withdrawal.id }
      });

      res.status(200).json({
        success: true,
        message: '提现申请已提交，请等待处理',
        data: {
          withdrawal_id: withdrawal.id,
          amount: withdrawAmount,
          status: 'processing',
          out_batch_no: outBatchNo
        }
      });

    } catch (apiError) {
      // 微信API调用失败
      console.error('WeChat Transfer API Error:', apiError);
      
      await Withdrawal.update({
        status: 'failed',
        fail_reason: apiError.message || '微信转账接口调用失败'
      }, {
        where: { id: withdrawal.id }
      });

      throw new AppError(`提现申请失败：${apiError.message}`, 500);
    }

  } catch (error) {
    // 如果事务还未提交，回滚
    if (t.finished !== 'commit') {
      await t.rollback();
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
 * 提现回调处理（微信异步通知）
 */
exports.withdrawalCallback = async (req, res, next) => {
  try {
    const wechatPayService = new WechatPayV3Service();
    
    // 验证签名
    const isValid = await wechatPayService.verifySignature(req);
    if (!isValid) {
      throw new AppError('签名验证失败', 400);
    }

    // 解密数据
    const result = await wechatPayService.decryptCallback(req.body);
    const { out_bill_no, transfer_state, fail_reason } = result;

    // 更新提现状态
    const updateData = {};
    if (transfer_state === 'SUCCESS') {
      updateData.status = 'success';
      updateData.completed_at = new Date();
    } else if (transfer_state === 'FAIL') {
      updateData.status = 'failed';
      updateData.fail_reason = fail_reason;
    }

    if (Object.keys(updateData).length > 0) {
      await Withdrawal.update(updateData, {
        where: { out_batch_no: out_bill_no }
      });
    }

    // 返回成功响应
    res.status(200).json({ code: 'SUCCESS', message: '成功' });
  } catch (error) {
    console.error('Withdrawal callback error:', error);
    res.status(500).json({ code: 'FAIL', message: error.message });
  }
};

module.exports = exports;