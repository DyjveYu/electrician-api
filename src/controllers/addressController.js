/**
 * 地址管理控制器
 * 处理用户地址的增删改查、设置默认地址等功能
 */

const addressSchemas = require('../schemas/addressSchemas');

class AddressController {
  /**
   * 获取用户地址列表
   */
  static async getAddresses(req, res, next) {
    try {
      const Address = require('../models/Address');
      const userId = req.user.id;
      const { page = 1, limit = 10 } = req.query;

      // 验证请求参数
      const { error } = addressSchemas.getAddresses.query.validate({ page: parseInt(page), limit: parseInt(limit) });
      if (error) {
        return res.error(error.details[0].message, 400);
      }

      const addresses = await Address.getByUserId(userId, parseInt(page), parseInt(limit));
      const total = await Address.getCountByUserId(userId);

      res.success({
        addresses,
        pagination: {
          page: parseInt(page),
          limit: parseInt(limit),
          total,
          pages: Math.ceil(total / parseInt(limit))
        }
      });
    } catch (error) {
      next(error);
    }
  }

  /**
   * 获取地址详情
   */
  static async getAddressDetail(req, res, next) {
    try {
      const Address = require('../models/Address');
      const userId = req.user.id;
      const { id } = req.params;

      // 验证请求参数
      const { error } = addressSchemas.getAddressDetail.params.validate({ id: parseInt(id) });
      if (error) {
        return res.error(error.details[0].message, 400);
      }

      const address = await Address.getById(parseInt(id));
      
      if (!address) {
        return res.error('地址不存在', 404);
      }

      // 检查地址是否属于当前用户
      if (address.user_id !== userId) {
        return res.error('无权访问此地址', 403);
      }

      res.success({ address });
    } catch (error) {
      next(error);
    }
  }

  /**
   * 创建新地址
   */
  static async createAddress(req, res, next) {
    try {
      console.log('createAddress - req.body:', JSON.stringify(req.body, null, 2));
      console.log('createAddress - req.user:', JSON.stringify(req.user, null, 2));
      
      const Address = require('../models/Address');
      const userId = req.user.id;
      const addressData = req.body;

      // 验证请求数据
      const { error } = addressSchemas.createAddress.body.validate(addressData);
      if (error) {
        return res.error(error.details[0].message, 400);
      }

      // 转换字段名为数据库字段名
      const dbAddressData = {
        user_id: userId,
        contact_name: addressData.contactName || addressData.contact_name,
        contact_phone: addressData.contactPhone || addressData.contact_phone,
        province: addressData.province,
        city: addressData.city,
        district: addressData.district,
        detail_address: addressData.detailAddress || addressData.detail,
        longitude: addressData.longitude || null,
        latitude: addressData.latitude || null,
        // 转换字符串 "true" 为布尔值
        is_default: addressData.isDefault === true || 
                    addressData.is_default === true || 
                    addressData.isDefault === "true" || 
                    addressData.is_default === "true" || 
                    false
      };
      
      console.log('createAddress - dbAddressData before create:', JSON.stringify(dbAddressData, null, 2));

      // 如果设置为默认地址，先清除其他默认地址
      if (addressData.isDefault) {
        await Address.clearDefaultByUserId(userId);
      }

      const addressId = await Address.create(dbAddressData);
      
      if (addressId) {
        const newAddress = await Address.getById(addressId);
        res.success({ 
          message: '地址创建成功',
          address: newAddress
        });
      } else {
        res.error('地址创建失败', 500);
      }
    } catch (error) {
      next(error);
    }
  }

  /**
   * 更新地址信息
   */
  static async updateAddress(req, res, next) {
    try {
      const Address = require('../models/Address');
      const userId = req.user.id;
      const { id } = req.params;
      const updateData = req.body;

      // 验证请求参数
      const { error: paramError } = addressSchemas.updateAddress.params.validate({ id: parseInt(id) });
      if (paramError) {
        return res.error(paramError.details[0].message, 400);
      }

      // 验证请求数据
      const { error } = addressSchemas.updateAddress.body.validate(updateData);
      if (error) {
        return res.error(error.details[0].message, 400);
      }

      // 检查地址是否存在且属于当前用户
      const existingAddress = await Address.getById(parseInt(id));
      if (!existingAddress) {
        return res.error('地址不存在', 404);
      }

      if (existingAddress.user_id !== userId) {
        return res.error('无权修改此地址', 403);
      }

      // 转换字段名为数据库字段名
      const dbUpdateData = {
        contact_name: updateData.contactName || updateData.contact_name,
        contact_phone: updateData.contactPhone || updateData.contact_phone,
        province: updateData.province,
        city: updateData.city,
        district: updateData.district,
        detail_address: updateData.detailAddress || updateData.detail,
        longitude: updateData.longitude || null,
        latitude: updateData.latitude || null,
        is_default: updateData.isDefault === true || 
                    updateData.is_default === true || 
                    updateData.isDefault === "true" || 
                    updateData.is_default === "true" || 
                    false
      };

      // 如果设置为默认地址，先清除其他默认地址
      if (dbUpdateData.is_default) {
        await Address.clearDefaultByUserId(userId);
      }

      const success = await Address.updateById(parseInt(id), dbUpdateData);
      
      if (success) {
        const updatedAddress = await Address.getById(parseInt(id));
        res.success({ 
          message: '地址更新成功',
          address: updatedAddress
        });
      } else {
        res.error('地址更新失败', 500);
      }
    } catch (error) {
      next(error);
    }
  }

  /**
   * 删除地址
   */
  static async deleteAddress(req, res, next) {
    try {
      const Address = require('../models/Address');
      const userId = req.user.id;
      const { id } = req.params;

      // 验证请求参数
      const { error } = addressSchemas.deleteAddress.params.validate({ id: parseInt(id) });
      if (error) {
        return res.error(error.details[0].message, 400);
      }

      // 检查地址是否存在且属于当前用户
      const existingAddress = await Address.getById(parseInt(id));
      if (!existingAddress) {
        return res.error('地址不存在', 404);
      }

      if (existingAddress.user_id !== userId) {
        return res.error('无权删除此地址', 403);
      }

      const success = await Address.delete(parseInt(id));
      
      if (success) {
        res.success({ message: '地址删除成功' });
      } else {
        res.error('地址删除失败', 500);
      }
    } catch (error) {
      next(error);
    }
  }

  /**
   * 设置默认地址
   */
  static async setDefaultAddress(req, res, next) {
    try {
      const Address = require('../models/Address');
      const userId = req.user.id;
      const { id } = req.params;

      // 验证请求参数
      const { error } = addressSchemas.setDefaultAddress.params.validate({ id: parseInt(id) });
      if (error) {
        return res.error(error.details[0].message, 400);
      }

      // 检查地址是否存在且属于当前用户
      const existingAddress = await Address.getById(parseInt(id));
      if (!existingAddress) {
        return res.error('地址不存在', 404);
      }

      if (existingAddress.user_id !== userId) {
        return res.error('无权设置此地址为默认', 403);
      }

      const success = await Address.setDefault(parseInt(id), userId);
      
      if (success) {
        res.success({ message: '默认地址设置成功' });
      } else {
        res.error('默认地址设置失败', 500);
      }
    } catch (error) {
      next(error);
    }
  }

  /**
   * 获取地区数据
   */
  static async getRegions(req, res, next) {
    try {
      console.log('=== getRegions method called ===');
      
      // 尝试多种方式加载Address模块
      let AddressModel;
      try {
        AddressModel = require('../models/Address');
        console.log('AddressModel loaded via require:', typeof AddressModel);
      } catch (requireError) {
        console.error('Error requiring Address:', requireError);
        return res.error('模块加载失败', 500);
      }
      
      if (!AddressModel) {
        console.error('AddressModel is null or undefined');
        return res.error('Address模块未定义', 500);
      }
      
      if (typeof AddressModel.getRegions !== 'function') {
        console.error('getRegions method not found on AddressModel');
        console.log('Available methods:', Object.getOwnPropertyNames(AddressModel));
        return res.error('getRegions方法不存在', 500);
      }
      
      console.log('AddressModel validation passed');
      
      const { parent_code = null, level = 1 } = req.query;
      console.log('Query params:', { parent_code, level });

      // 验证请求参数
      const { error } = addressSchemas.getRegions.query.validate({ 
        parentCode: parent_code || '', 
        level: parseInt(level) 
      });
      if (error) {
        console.log('Validation error:', error.details[0].message);
        return res.error(error.details[0].message, 400);
      }

      console.log('Starting database operations...');
      
      // 确保regions表存在并有数据
      await AddressModel.createRegionsTable();
      console.log('Regions table created/verified');
      
      await AddressModel.initRegionsData();
      console.log('Regions data initialized');

      const regions = await AddressModel.getRegions(parent_code, parseInt(level));
      console.log('Regions retrieved:', regions.length, 'items');
      
      res.success({ regions });
    } catch (error) {
      console.error('Error in getRegions:', error);
      console.error('Error stack:', error.stack);
      next(error);
    }
  }

  /**
   * 获取用户默认地址
   */
  static async getDefaultAddress(req, res, next) {
    try {
      const Address = require('../models/Address');
      const userId = req.user.id;

      const defaultAddress = await Address.getDefaultByUserId(userId);
      
      res.success({ 
        address: defaultAddress 
      });
    } catch (error) {
      next(error);
    }
  }
}

module.exports = AddressController;