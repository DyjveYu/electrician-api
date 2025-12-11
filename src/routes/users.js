const express = require('express');
const router = express.Router();
const userController = require('../controllers/userController');
const { authenticateToken } = require('../middleware/auth');

/**
 * @swagger
 * /api/users/profile:
 *   get:
 *     summary: 获取用户资料
 *     tags: [Users]
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: 获取用户资料成功
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 code:
 *                   type: integer
 *                   example: 200
 *                 message:
 *                   type: string
 *                   example: 获取用户资料成功
 *                 data:
 *                   type: object
 *                   properties:
 *                     id:
 *                       type: integer
 *                     phone:
 *                       type: string
 *                     nickname:
 *                       type: string
 *                     avatar:
 *                       type: string
 *                     gender:
 *                       type: string
 *                       enum: [male, female, unknown]
 *                     birthday:
 *                       type: string
 *                       format: date
 *                     bio:
 *                       type: string
 *       401:
 *         description: 未授权
 *       404:
 *         description: 用户不存在
 */
router.get('/profile', authenticateToken, userController.getProfile);

/**
 * @swagger
 * /api/users/profile:
 *   put:
 *     summary: 更新用户资料
 *     tags: [Users]
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               nickname:
 *                 type: string
 *                 minLength: 1
 *                 maxLength: 50
 *                 description: 用户昵称
 *               avatar:
 *                 type: string
 *                 format: uri
 *                 description: 用户头像URL
 *               gender:
 *                 type: string
 *                 enum: [male, female, unknown]
 *                 description: 用户性别
 *               birthday:
 *                 type: string
 *                 format: date
 *                 description: 用户生日
 *               bio:
 *                 type: string
 *                 maxLength: 200
 *                 description: 个人简介
 *             minProperties: 1
 *     responses:
 *       200:
 *         description: 用户资料更新成功
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 code:
 *                   type: integer
 *                   example: 200
 *                 message:
 *                   type: string
 *                   example: 用户资料更新成功
 *                 data:
 *                   type: object
 *                   properties:
 *                     id:
 *                       type: integer
 *                     phone:
 *                       type: string
 *                     nickname:
 *                       type: string
 *                     avatar:
 *                       type: string
 *                     gender:
 *                       type: string
 *                     birthday:
 *                       type: string
 *                     bio:
 *                       type: string
 *       400:
 *         description: 请求参数错误
 *       401:
 *         description: 未授权
 *       404:
 *         description: 用户不存在
 */
router.put('/profile', authenticateToken, userController.updateProfile);

module.exports = router;