const ShoppingService = require("../services/shopping-service");
const { PublishCustomerEvent, SubscribeMessage, PublishMessage } = require("../utils");
const UserAuth = require('./middlewares/auth');
const { CUSTOMER_SERVICE } = require('../config');

module.exports = (app, channel) => {
    
    const service = new ShoppingService();
    SubscribeMessage(channel, service);
    
    // Get all orders (admin endpoint)
    app.get('/admin/orders', UserAuth, async (req, res, next) => {
        try {
            const orders = await service.repository.Orders();
            res.status(200).json(orders);
        } catch (error) {
            console.error('Error getting all orders:', error);
            res.status(500).json({ error: error.message });
        }
    });

    // Update order status using MongoDB _id
    app.put('/admin/order/:_id', UserAuth, async (req, res, next) => {
        try {
            const { _id } = req.params;
            const { status } = req.body;

            if (!status) {
                return res.status(400).json({ error: 'Status is required' });
            }

            if (!['created', 'received', 'shipped', 'delivered', 'cancelled'].includes(status)) {
                return res.status(400).json({ error: 'Invalid status value' });
            }

            const updatedOrder = await service.repository.UpdateOrderStatus(_id, status);
            if (!updatedOrder) {
                return res.status(404).json({ error: 'Order not found' });
            }

            const payload = await service.GetOrderPayload(updatedOrder.customerId, updatedOrder, 'UPDATE_ORDER');
            PublishMessage(channel, CUSTOMER_SERVICE, JSON.stringify(payload));

            res.status(200).json(updatedOrder);
        } catch (error) {
            console.error('Error updating order status:', error);
            res.status(500).json({ error: error.message });
        }
    });

    // Delete order
    app.delete('/admin/order/:orderId', UserAuth, async (req, res, next) => {
        try {
            const { orderId } = req.params;
            const deletedOrder = await service.repository.DeleteOrder(orderId);
            if (!deletedOrder) {
                return res.status(404).json({ error: 'Order not found' });
            }

            const payload = await service.GetOrderPayload(deletedOrder.customerId, deletedOrder, 'DELETE_ORDER');
            PublishMessage(channel, CUSTOMER_SERVICE, JSON.stringify(payload));

            res.status(200).json({ message: 'Order deleted successfully' });
        } catch (error) {
            console.error('Error deleting order:', error);
            res.status(500).json({ error: error.message });
        }
    });

    // Existing endpoints
    app.post('/order', UserAuth, async (req, res, next) => {
        try {
            const { _id } = req.user;
            const { txnNumber, address } = req.body;
            
            if (!txnNumber) {
                return res.status(400).json({ error: 'Transaction number is required' });
            }
            
            if (!address) {
                return res.status(400).json({ error: 'Address is required' });
            }
            
            const { street, city, postalCode, country } = address;
            if (!street || !city || !postalCode || !country) {
                return res.status(400).json({ 
                    error: 'Address must include street, city, postalCode, and country' 
                });
            }
            
            const { data } = await service.PlaceOrder({_id, txnNumber, address});
            
            const payload = await service.GetOrderPayload(_id, data, 'CREATE_ORDER');
            PublishMessage(channel, CUSTOMER_SERVICE, JSON.stringify(payload));
            
            res.status(200).json(data);
        } catch (error) {
            console.error('Error creating order:', error);
            res.status(500).json({ error: error.message });
        }
    });
    
    app.get('/orders', UserAuth, async (req, res, next) => {
        try {
            const { _id } = req.user;
            const { data } = await service.GetOrders(_id);
            
            res.status(200).json(data);
        } catch (error) {
            console.error('Error getting orders:', error);
            res.status(500).json({ error: error.message });
        }
    });
    
    app.put('/cart', UserAuth, async (req, res, next) => {
        try {
            const { _id } = req.user;
            const { data } = await service.AddToCart(_id, req.body._id);
            
            res.status(200).json(data);
        } catch (error) {
            console.error('Error updating cart:', error);
            res.status(500).json({ error: error.message });
        }
    });
    
    app.delete('/cart/:id', UserAuth, async (req, res, next) => {
        try {
            const { _id } = req.user;
            const { data } = await service.AddToCart(_id, req.params.id);
            
            res.status(200).json(data);
        } catch (error) {
            console.error('Error removing from cart:', error);
            res.status(500).json({ error: error.message });
        }
    });
    
    app.get('/cart', UserAuth, async (req, res, next) => {
        try {
            const { _id } = req.user;
            const { data } = await service.GetCart({ _id });
            return res.status(200).json(data);
        } catch (error) {
            console.error('Error getting cart:', error);
            res.status(500).json({ error: error.message });
        }
    });
    
    app.get('/whoami', (req, res, next) => {
        return res.status(200).json({msg: '/shopping : I am Shopping Service'});
    });
};