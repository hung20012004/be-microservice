const mongoose = require('mongoose');
const { OrderModel, CartModel } = require('../models');
const { v4: uuidv4 } = require('uuid');

class ShoppingRepository {
    async Orders(customerId) {
        if (customerId) {
            return await OrderModel.find({ customerId });
        }
        return await OrderModel.find();
    }
    
    async Cart(customerId) {
        const cartItems = await CartModel.find({ customerId: customerId });
        
        if (cartItems) {
            return cartItems;
        }
        
        throw new Error('Data Not found!');
    }
    
    async AddCartItem(customerId, item, qty, isRemove) {
        const cart = await CartModel.findOne({ customerId: customerId });
        const { _id } = item;
        
        if (cart) {
            let isExist = false;
            let cartItems = cart.items;
            
            if (cartItems.length > 0) {
                cartItems = cartItems.map(item => {
                    if (item.product._id.toString() === _id.toString()) {
                        if (isRemove) {
                            return null;
                        } else {
                            item.unit = qty;
                        }
                        isExist = true;
                        return item;
                    }
                    return item;
                }).filter(item => item !== null);
            }
            
            if (!isExist && !isRemove) {
                cartItems.push({ product: { ...item }, unit: qty });
            }
            
            cart.items = cartItems;
            return await cart.save();
        } else {
            return await CartModel.create({
                customerId,
                items: [{ product: { ...item }, unit: qty }]
            });
        }
    }

    async CreateNewOrder(customerId, txnId, address) {
        const cart = await CartModel.findOne({ customerId: customerId });
        
        if (cart) {
            let amount = 0;
            let cartItems = cart.items;
            
            if (cartItems.length > 0) {
                cartItems.forEach(item => {
                    amount += parseInt(item.product.price) * parseInt(item.unit);
                });
                
                const orderId = uuidv4();
                
                const order = new OrderModel({
                    orderId,
                    customerId,
                    amount,
                    status: 'created',
                    address: address,
                    items: cartItems
                });
                
                cart.items = [];
                const orderResult = await order.save();
                await cart.save();
                return orderResult;
            }
        }
        return {};
    }

    async UpdateOrderStatus(_id, status) {
        const order = await OrderModel.findById(_id);
        if (!order) {
            return null;
        }
        order.status = status;
        return await order.save();
    }

    async DeleteOrder(orderId) {
        const order = await OrderModel.findOneAndDelete({ orderId });
        return order;
    }
}

module.exports = ShoppingRepository;