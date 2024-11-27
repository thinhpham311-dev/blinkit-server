import { Order, Customer, Branch, DeliveryPartner } from "../../models/index.js"
import { handleError } from "../../utils/errorHandler.js";


export const createOrder = async (req, reply) => {
    try {
        const { userId } = req.user;
        const { items, branch, totalPrice } = req.body;
        const customerData = await Customer.findById(userId);
        const branchData = await Branch.findById(branch);

        if (!customerData) {
            return reply.status(404).send({ message: "Customer not found" });
        }

        const newOrder = new Order({
            customer: userId,
            items: items.map((item) => ({
                id: item.id,
                item: item.item,
                count: item.count
            })),
            branch: branchData,
            totalPrice,
            deliveryLocation: {
                latitude: customerData.liveLocation.latitude,
                longtitude: customerData.liveLocation.longtitude,
                address: customerData.address || "No address available"
            },
            pickupLocation: {
                latitude: branchData.liveLocation.latitude,
                longtitude: branchData.liveLocation.longtitude,
                address: branchData.address || "No address available"
            }
        });
        const savedOrder = await newOrder.save();
        return reply.status(200).send({ message: "Created orders successfully", order: savedOrder });

    } catch (error) {
        // Use the custom error handler to format the error
        const { statusCode, message, details } = handleError(error);
        return reply.status(statusCode).send({ message, details });
    }
}

export const confirmOrder = async (req, reply) => {
    try {
        const { orderId } = req.params;
        const { userId } = req.user;
        const { deliveryPersonLocation } = req.body;
        const deliveryPerson = await DeliveryPartner.findById(userId);
        if (!deliveryPerson) {
            return reply.status(404).send({ message: "Delivery Person not found" });
        }
        const order = await Order.findById(orderId);
        if (!order) {
            return reply.status(404).send({ message: "Order not found" });
        }
        if (order.status !== "available") {
            return reply.status(400).send({ message: "Order is not available" });
        }
        order.status = "confirmed";

        order.deliveryPartner = userId;
        order.deliveryPersonLocation = {
            latitude: deliveryPersonLocation?.latitude,
            longtitude: deliveryPersonLocation?.longtitude,
            address: deliveryPersonLocation?.address || ""
        }

        req.server.io.to(orderId).emit("orderConfirmed", order)

        await order.save();

        return reply.status(200).send({ message: "Order confirmed successfully" });
    } catch (error) {
        // Use the custom error handler to format the error
        const { statusCode, message, details } = handleError(error);
        return reply.status(statusCode).send({ message, details });
    }
}

export const updateOrderStatus = async (req, reply) => {
    try {
        const { orderId } = req.params;
        const { status, deliveryPersonLocation } = req.body;
        const { userId } = req.user;

        const deliveryPerson = await DeliveryPartner.findById(userId);

        if (!deliveryPerson) {
            return reply.status(404).send({ message: "Delivery Person not found" });
        }

        const order = await Order.findById(orderId);
        if (!order) {
            return reply.status(404).send({ message: "Order not found" });
        }

        if (['cancelled', 'delivered'].includes(order.status)) {
            return reply.status(400).send({ message: "Order cannot be updated" });
        }

        if (order.deliveryPartner.toString() !== userId) {
            return reply.status(403).send({ message: "Unauthorized" });
        }

        order.status = status;
        order.deliveryPartner = userId;
        order.deliveryPersonLocation = deliveryPersonLocation;

        req.server.io.to(orderId).emit("liveTrackingUpdates", order)

        await order.save()
        return reply.status(200).send({ message: "Order confirmed successfully", });
    } catch (error) {
        // Use the custom error handler to format the error
        const { statusCode, message, details } = handleError(error);
        return reply.status(statusCode).send({ message, details });
    }
}


export const getOrders = async (req, reply) => {

    try {
        const { status, customerId, deliveryPartnerId, branchId } = req.query;
        let query = {};

        if (status) {
            query.status = status;
        }

        if (customerId) {
            query.customer = customerId;
        }

        if (deliveryPartnerId) {
            query.deliveryPartner = deliveryPartnerId;
            query.branch = branchId;
        }

        const orders = await Order.find(query).populate("customer branch items.item deliveryPartner")

        return reply.status(200).send({ message: "Get Orders List successfully", orders });

    } catch (error) {
        // Use the custom error handler to format the error
        const { statusCode, message, details } = handleError(error);
        return reply.status(statusCode).send({ message, details });
    }
}


export const getOrderById = async (req, reply) => {
    try {
        const { orderId } = req.params;

        const order = await Order.findById(orderId).populate(
            "customer branch items.item deliveryPartner"
        )


        if (!order) {
            return reply.status(404).send({ message: "Order not found" })
        }

        return reply.status(200).send({ message: "Get Order successfully", order });

    } catch (error) {
        // Use the custom error handler to format the error
        const { statusCode, message, details } = handleError(error);
        return reply.status(statusCode).send({ message, details });
    }
}