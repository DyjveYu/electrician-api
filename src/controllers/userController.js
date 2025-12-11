const User = require('../models/User');
const userSchemas = require('../schemas/userSchemas');

/**
 * 更新用户资料
 */
const updateProfile = async (req, res, next) => {
  try {
    // 验证请求数据
    const { error, value } = userSchemas.updateProfile.body.validate(req.body);
    if (error) {
      return res.error(error.details[0].message, 400);
    }

    const userId = req.user.id;
    const updateData = value;

    console.log('更新用户资料', {
      userId,
      updateData
    });

    // 检查用户是否存在
    const user = await User.findById(userId);
    if (!user) {
      return res.error('用户不存在', 404);
    }

    // 更新用户资料
    const updateResult = await User.update(userId, updateData);
    if (!updateResult.success) {
      return res.error(updateResult.message || '用户资料更新失败', 500);
    }

    // 返回更新后的用户信息
    const updatedUser = await User.findById(userId);

    console.log('用户资料更新成功', {
      userId,
      updatedFields: Object.keys(updateData)
    });

    res.success({
      message: '用户资料更新成功',
      user: updatedUser
    });
  } catch (error) {
    console.error('更新用户资料失败', {
      userId: req.user?.id,
      error: error.message,
      stack: error.stack
    });
    next(error);
  }
};

/**
 * 获取用户资料
 */
const getProfile = async (req, res, next) => {
  try {
    const userId = req.user.id;

    console.log('获取用户资料', { userId });

    // 获取用户信息
    const user = await User.findById(userId);

    if (!user) {
      return res.error('用户不存在', 404);
    }

    res.success({
      message: '获取用户资料成功',
      user: user
    });
  } catch (error) {
    console.error('获取用户资料失败', {
      userId: req.user?.id,
      error: error.message,
      stack: error.stack
    });
    next(error);
  }
};

module.exports = {
  updateProfile,
  getProfile
};