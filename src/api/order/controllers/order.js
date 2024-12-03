'use strict';

// @ts-ignore
const stripe = require('stripe')("sk_test_51QRlfVABogrp7lDZCz2FZMlSjXNQFdabTMxQyCPyNWbpSGG3pOxbYUTQ6OIcMZ7Xqb9RUgjjojL7SQSyz8NXcF4200AaD961Tr"); // Asegúrate de que 'STRIPE_KEY' está en las variables de entorno

/**
 * order controller
 */
const { createCoreController } = require('@strapi/strapi').factories;

module.exports = createCoreController("api::order.order", ({ strapi }) => ({
    async create(ctx) {
        try {
            const { products } = ctx.request.body; // Productos recibidos en el cuerpo de la solicitud

            // Crear los 'line_items' de la sesión de Stripe
            const lineItems = await Promise.all(
                products.map(async (product) => {
                    const item = await strapi.service("api::product.product").findOne(product.id);

                    return {
                        price_data: {
                            currency: "ARS",
                            product_data: {
                                name: item.productName,
                            },
                            unit_amount: Math.round(item.price * 100), // Asegúrate de que los precios estén en centavos
                        },
                        quantity: 1,
                    };
                })
            );

            // Crear la sesión de pago en Stripe
            const session = await stripe.checkout.sessions.create({
                shipping_address_collection: { allowed_countries: ["AR"] }, // Corrección en 'allowed_countries'
                payment_method_types: ["card"],
                mode: "payment",
                success_url: `${process.env.CLIENT_URL}/success`, // Asegúrate de que 'CLIENT_URL' esté en el entorno
                cancel_url: `${process.env.CLIENT_URL}/successError`, // Asegúrate de que 'CLIENT_URL' esté en el entorno
                line_items: lineItems,
            });

            // Crear la orden en la base de datos (si es necesario)
            await strapi.service("api::order.order").create({
                data: {
                    products,
                    stripeId: session.id,
                },
            });

            // Devolver la sesión de Stripe
            return { stripeSession: session };

        } catch (error) {
            console.error('Error en la creación de la sesión de pago:', error);
            ctx.response.status = 500;
            return { error: error.message || 'Error interno del servidor' };
        }
    }
}));