/**
 * 修复后的 electricianController.js - withdraw 方法
 * 解决429频率限制问题
 */

const { Order, Payment, Review, User, ElectricianCertification, Withdrawal, sequelize } = require('../models');
const AppError = require('../utils/AppError');
const WechatPayV3Service = require('../utils/WechatPayV3Service');
const { Op } = require('sequelize');
const crypto = require('crypto');

/**
 * 生成唯一的商户订单号
 * 避免高并发下的订单号重复
 */
function generateOutBatchNo(electricianId) {
  const timestamp = Date.now();
  const random = crypto.randomBytes(4).toString('hex'); // 8位随机字符
  return `W${timestamp}${electricianId}${random}`.substring(0, 32); // 限制32字符
}

/**
 * 申请提现（修复版）
 */
exports.withdraw = async (req, res, next) => {
  const t = await sequelize.transaction();
  
  try {
    const electricianId = req.user.id;
    const { amount } = req.body;

    // ========================================
    // 1. 防止重复提交检查
    // ========================================
    const recentWithdrawal = await Withdrawal.findOne({
      where: {
        electrician_id: electricianId,
        status: { [Op.in]: ['pending', 'processing'] },
        created_at: {
          [Op.gte]: new Date(Date.now() - 60000) // 1分钟内
        }
      },
      transaction: t
    });

    if (recentWithdrawal) {
      await t.rollback();
      throw new AppError('您有提现申请正在处理中，请稍后再试', 400);
    }

    // ========================================
    // 2. 获取用户信息
    // ========================================
    const user = await User.findByPk(electricianId, {
      attributes: ['id', 'openid'],
      transaction: t
    });

    if (!user || !user.openid) {
      await t.rollback();
      throw new AppError('用户未绑定微信，无法提现', 400);
    }

    // ========================================
    // 3. 获取实名信息
    // ========================================
    const certification = await ElectricianCertification.findOne({
      where: { 
        user_id: electricianId,
        status: 'approved'
      },
      attributes: ['real_name'],
      transaction: t
    });

    if (!certification || !certification.real_name) {
      await t.rollback();
      throw new AppError('请先完成实名认证', 400);
    }

    // ========================================
    // 4. 计算可提现余额
    // ========================================
    const balance = await calculateBalance(electricianId, t);

    const withdrawAmount = amount ? Number(amount) : balance.availableBalance;

    // 验证金额
    if (withdrawAmount < 0.3) {
      await t.rollback();
      throw new AppError('提现金额不能低于0.30元', 400);
    }

    if (withdrawAmount > balance.availableBalance) {
      await t.rollback();
      throw new AppError(`余额不足，可用余额：¥${balance.availableBalance}`, 400);
    }

    // ========================================
    // 5. 生成唯一订单号并创建提现记录
    // ========================================
    const outBatchNo = generateOutBatchNo(electricianId);
    
    console.log(`[提现] 电工ID: ${electricianId}, 金额: ${withdrawAmount}, 订单号: ${outBatchNo}`);
    
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

    // ========================================
    // 6. 提交事务（在调用微信API前）
    // ========================================
    await t.commit();
    console.log(`[提现] 订单已创建: ${withdrawal.id}`);

    // ========================================
    // 7. 调用微信转账API（事务外执行）
    // ========================================
    let transferResult = null;
    try {
      const wechatPayService = new WechatPayV3Service();
      
      const transferParams = {
        out_bill_no: outBatchNo,
        transfer_scene_id: '1005', // 劳务报酬
        openid: user.openid,
        user_name: certification.real_name,
        transfer_amount: Math.round(withdrawAmount * 100),
        transfer_remark: '电工收入提现',
        user_recv_perception: '电工佣金',
        transfer_scene_report_infos: [
          {
            info_type: '场景描述',
            info_content: '平台佣金发放'
          }
        ]
      };

      console.log(`[提现] 调用微信API: ${outBatchNo}`);
      transferResult = await wechatPayService.createTransferBill(transferParams);
      console.log(`[提现] 微信API返回:`, transferResult);

      // ========================================
      // 8. 更新提现状态
      // ========================================
      await Withdrawal.update({
        status: 'processing',
        transfer_bill_no: transferResult.transfer_bill_no || transferResult.out_bill_no,
        package_info: transferResult.package_info // ⚠️ 小程序需要这个字段
      }, {
        where: { id: withdrawal.id }
      });

      console.log(`[提现] 状态已更新为processing: ${withdrawal.id}`);

      // ========================================
      // 9. 返回成功响应（包含package_info）
      // ========================================
      res.status(200).json({
        success: true,
        message: '提现申请已提交，请确认收款',
        data: {
          withdrawal_id: withdrawal.id,
          amount: withdrawAmount,
          status: 'processing',
          out_batch_no: outBatchNo,
          package_info: transferResult.package_info // ✅ 小程序用这个拉起收款页面
        }
      });

    } catch (apiError) {
      // ========================================
      // 10. 微信API调用失败处理
      // ========================================
      console.error('[提现] 微信API错误:', apiError);
      
      // 检查是否是429错误
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
    // 如果事务还未提交，回滚
    if (t.finished !== 'commit') {
      await t.rollback();
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
 * 计算电工收入余额（复用之前的函数）
 */
async function calculateBalance(electricianId, transaction = null) {
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

  const withdrawnResult = await Withdrawal.sum('amount', {
    where: {
      electrician_id: electricianId,
      status: { [Op.in]: ['success', 'processing'] }
    },
    transaction
  });
  const withdrawnAmount = withdrawnResult || 0;

  const availableBalance = Number((totalIncome - withdrawnAmount).toFixed(2));

  return {
    totalIncome: Number(totalIncome.toFixed(2)),
    withdrawnAmount: Number(withdrawnAmount.toFixed(2)),
    availableBalance
  };
}

module.exports = exports;