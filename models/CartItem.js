const mongoose = require('mongoose');

const cartItemSchema = new mongoose.Schema({
  product: { type: String, required: true },
  quantity: { type: Number, required: true, min: 1 },
  price: { type: Number, required: true }
});

const CartItem = mongoose.model('CartItem', cartItemSchema);

module.exports = CartItem;
