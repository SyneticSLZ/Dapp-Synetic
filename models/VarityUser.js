const mongoose = require('mongoose');
const bcrypt = require('bcryptjs');

const varityUserSchema = new mongoose.Schema({
  email: { type: String, required: true, unique: true },
  password: { type: String },
  walletAddress: { type: String, required: true, unique: true },
  mnemonic: { type: String, required: true, unique: true },
  cart: [{
    type: mongoose.Schema.Types.ObjectId,
    ref: 'CartItem'
  }]
});

varityUserSchema.pre('save', async function(next) {
  if (this.isModified('password')) {
    this.password = await bcrypt.hash(this.password, 10);
  }
  next();
});

const VarityUser = mongoose.model('VarityUser', varityUserSchema);

module.exports = VarityUser;
