const { ShoppingRepository } = require("../database");
const { FormateData } = require("../utils");

class ShoppingService {
    constructor() {
        this.repository = new ShoppingRepository();
    }

    async GetCart({ _id }) {
        const cartItems = await this.repository.Cart(_id);
        return FormateData(cartItems);
    }

    async PlaceOrder(userInput) {
        const { _id, txnNumber, address } = userInput;

        if (!address || !address.street || !address.city || !address.postalCode || !address.country) {
            throw new Error('Address information is required');
        }

        const orderResult = await this.repository.CreateNewOrder(_id, txnNumber, address);
        return FormateData(orderResult);
    }

    async GetOrders(customerId) {
        const orders = await this.repository.Orders(customerId);
        return FormateData(orders);
    }

    async GetAllOrders() {
        const orders = await this.repository.Orders();
        return FormateData(orders);
    }

    async UpdateOrderStatus(_id, status) {
        const updatedOrder = await this.repository.UpdateOrderStatus(_id, status);
        if (!updatedOrder) {
            throw new Error('Order not found');
        }
        return FormateData(updatedOrder);
    }

    async DeleteOrder(orderId) {
        const deletedOrder = await this.repository.DeleteOrder(orderId);
        if (!deletedOrder) {
            throw new Error('Order not found');
        }
        return FormateData(deletedOrder);
    }

    async GetOrderDetails({ _id, orderId }) {
        const orders = await this.repository.Orders(_id);
        return FormateData(orders);
    }

    async ManageCart(customerId, item, qty, isRemove) {
        const cartResult = await this.repository.AddCartItem(customerId, item, qty, isRemove);
        return FormateData(cartResult);
    }

    async SubscribeEvents(payload) {
        payload = JSON.parse(payload);
        const { event, data } = payload;
        const { userId, product, qty, order } = data;

        switch(event) {
            case 'ADD_TO_CART':
                await this.ManageCart(userId, product, qty, false);
                break;
            case 'REMOVE_FROM_CART':
                await this.ManageCart(userId, product, qty, true);
                break;
            case 'UPDATE_ORDER':
                await this.UpdateOrderStatus(order._id, order.status);
                break;
            case 'DELETE_ORDER':
                await this.DeleteOrder(order.orderId);
                break;
            default:
                break;
        }
    }

    async GetOrderPayload(userId, order, event) {
        if (order) {
            const payload = {
                event: event,
                data: { userId, order }
            };
            return payload;
        } else {
            return FormateData({ error: 'No Order Available' });
        }
    }
}

module.exports = ShoppingService;