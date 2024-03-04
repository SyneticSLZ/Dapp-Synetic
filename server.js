require('dotenv').config();
const express = require('express');
const mongoose = require('mongoose');
const Moralis = require("moralis").default;
const bcrypt = require('bcryptjs');
const CryptoJS = require('crypto-js');
const { ethers } = require('ethers');
const crypto = require('crypto');
const User = require('./models/User');
const VarityUser = require('./models/VarityUser');
const Client = require('./models/Client');
const app = express();
const cors = require("cors");
const corsOptions = {
  origin: 'http://127.0.0.1:5500', // or use an array of origins
  optionsSuccessStatus: 200 // some legacy browsers (IE11, various SmartTVs) choke on 204
};

app.use(cors(corsOptions));
app.use(express.json());
const jwt = require('jsonwebtoken');
/////////////////////////////////////////////////////////////////////- onboarding clients apis////////////////////////
// Function to generate JWT
const generateToken = (id) => {
  return jwt.sign({ id }, process.env.JWT_SECRET, {
    expiresIn: '30d', // Adjust based on your requirements
  });
};

// Middleware to protect routes
const protect = async (req, res, next) => {
  let token;

  if (
    req.headers.authorization &&
    req.headers.authorization.startsWith('Bearer')
  ) {
    try {
      // Get token from header
      token = req.headers.authorization.split(' ')[1];

      // Verify token
      const decoded = jwt.verify(token, process.env.JWT_SECRET);

      // Get client from the token
      req.client = await Client.findById(decoded.id).select('-password');

      next();
    } catch (error) {
      console.error(error);
      res.status(401).json({ message: 'Not authorized, token failed' });
    }
  }

  if (!token) {
    res.status(401).json({ message: 'Not authorized, no token' });
  }
};

mongoose.connect(process.env.MONGODB_URI, { useNewUrlParser: true, useUnifiedTopology: true })
    .then(() => console.log('MongoDB connected'))
    .catch(err => console.error('MongoDB connection error:', err));

const authenticateAPIKey = async (req, res, next) => {
    const apiKey = req.headers['x-api-key'];
    if (!apiKey) {
        return res.status(401).json({ success: false, message: 'API Key is required' });
    }
    try {
        const client = await Client.findOne({ apiKey });
        if (!client) {
            return res.status(401).json({ success: false, message: 'Invalid API Key' });
        }
        next();
    } catch (error) {
        console.error('Authentication Error:', error);
        return res.status(500).json({ success: false, message: 'Internal server error' });
    }
};

// Assuming you've added JWT_SECRET to your .env file for JWT signing
app.post('/onboard-new-client', async (req, res) => {
    try {
        const { name } = req.body;
        if (!name) {
            return res.status(400).json({ success: false, message: 'Client name is required' });
        }
        const apiKey = crypto.randomBytes(20).toString('hex');
        const newClient = new Client({ name, apiKey });
        await newClient.save();

        // Generate JWT for the client
        const token = generateToken(newClient._id);

        res.json({ success: true, token }); // Send the token to the client
    } catch (error) {
        console.error('Onboarding Error:', error);
        res.status(500).json({ success: false, message: 'Internal server error' });
    }
});


app.get('/client/api-key-partial', protect, async (req, res) => {
    try {
        const clientId = req.client._id;
        const client = await Client.findById(clientId);

        if (!client) {
            return res.status(404).json({ success: false, message: 'Client not found' });
        }

        // Optionally, partially obscure the API key for initial display
        const obscuredApiKey = client.apiKey.replace(/.(?=.{4})/g, '*');
        
        res.json({ success: true, apiKey: obscuredApiKey });
    } catch (error) {
        console.error('Error retrieving API key:', error);
        res.status(500).json({ success: false, message: 'Internal server error' });
    }
});

app.get('/client/api-key-full', protect, async (req, res) => {
    try {
        const clientId = req.client._id;
        const client = await Client.findById(clientId);

        if (!client) {
            return res.status(404).json({ success: false, message: 'Client not found' });
        }

        // Optionally, partially obscure the API key for initial display
        const obscuredApiKey = client.apiKey;
        
        res.json({ success: true, apiKey: obscuredApiKey });
    } catch (error) {
        console.error('Error retrieving API key:', error);
        res.status(500).json({ success: false, message: 'Internal server error' });
    }
});

///////////////////////////////////////////////////////////////// actual hidden apis//////////////////////////////////////////////

// create wallet with an email and password   ---- requires production grade encryption
app.post('/create-wallet', authenticateAPIKey, async (req, res) => {
    try {
        const { email, password } = req.body;
        if (!email || !password) {
            return res.status(400).json({ success: false, message: 'Email and password are required' });
        }
        const hashedPassword = bcrypt.hashSync(password, 10);
        const wallet = ethers.Wallet.createRandom();
        const encryptedPrivateKey = CryptoJS.AES.encrypt(wallet.privateKey, process.env.ENCRYPTION_SECRET).toString();
        const user = new User({ email, password: hashedPassword, walletAddress: wallet.address, encryptedPrivateKey });
        await user.save();
        res.json({ success: true, walletAddress: wallet.address });
    } catch (error) {
        console.error('Create Wallet Error:', error);
        res.status(500).json({ success: false, message: 'Internal server error' });
    }
});





//log in and get the users wallet address
app.post('/login', authenticateAPIKey, async (req, res) => {
    try {
        const { email, password } = req.body;
        const user = await User.findOne({ email });

        if (!user || !bcrypt.compareSync(password, user.password)) {
            return res.status(401).json({ success: false, message: 'Login failed' });
        }
        res.json({ success: true, walletAddress: user.walletAddress });

        // connect the users wallet to be able to sign transactions

    } catch (error) {
        console.error('Login Error:', error);
        res.status(500).json({ success: false, message: 'Internal server error' });
    }
});

// fetch-nft-data
app.post('/fetch-nft-data', authenticateAPIKey, async (req, res) => {
    try {

        // filter for the storename of the api key in metadata 

        const  userAddress = req.headers['Address'];
        const  chain = req.headers['chain'];
        const nfts = await Moralis.EvmApi.nft.getWalletNFTs({
            chain: chain,
            address: userAddress,
            mediaItems: true
          });

          const myNfts = nfts.raw.result.map((e, i) => {
            if (e?.media?.media_collection?.high?.url && !e.possible_spam && (e?.media?.category !== "video") ) {
              return e["media"]["media_collection"]["high"]["url"];
            }
          })
        
          const jsonResponse = {
            nfts: myNfts
          }
          return res.status(200).json(jsonResponse);

    } catch (error) {
        console.error('Create Wallet Error:', error);
        res.status(500).json({ success: false, message: 'Internal server error' });
    }
});

// Mint NFT
app.post('/mint-nft', authenticateAPIKey, async (req, res) => {
    try {

//

    } catch (error) {
        console.error('Create Wallet Error:', error);
        res.status(500).json({ success: false, message: 'Internal server error' });
    }
});


////////////////////////////////////////////////////////////////////

// Login Endpoint
app.post('/login-varity', async (req, res) => {
    const { email, password } = req.body;
    const user = await VarityUser.findOne({ email });
  
    if (!user) {
      return res.status(404).send({ error: 'User not found' });
    }
    // const entered = 
    console.log(password, user.upwrd);
    const isMatch =   await bcrypt.compare(password, user.upwrd);
  
    if (!isMatch) {
      return res.status(400).send({ error: 'Invalid password' });
    }
  
    res.send({ email: user.email, address: user.walletAddress });
  });

  app.post('/create-varity-account', async (req, res) => {
    try {
      const { email, password } = req.body;
  
      // Check for required fields
      if (!email || !password) {
        return res.status(400).send({ error: 'Email and password are required' });
      }
  
      // Check if user already exists
      // const existingUser = await VarityUser.findOne({ email });
      // if (existingUser) {
      //   return res.status(400).send({ error: 'User already exists' });
      // }
  
      // Create wallet and user
      const user = await createWalletAndUser(email, password);
  
      // Send back the necessary response
      res.status(201).send({
        email: user.email,
        walletAddress: user.walletAddress,
        password: user.upwrd
        // Include any other info you want to send back
      });
  
    } catch (error) {
      console.error('Create Varity Account Error:', error);
      res.status(500).send({ error: 'Internal server error' });
    }
  });

  
// Function to create a wallet and user
async function createWalletAndUser(email, password) {
  const hashedPassword = bcrypt.hashSync(password, 10);
  const wallet = ethers.Wallet.createRandom();
  const encryptedPrivateKey = CryptoJS.AES.encrypt(wallet.privateKey, process.env.ENCRYPTION_SECRET).toString();
  // const mnemonic = CryptoJS.AES.encrypt(wallet.mnemonic.phrase, process.env.ENCRYPTION_SECRET).toString();
  const mnemonic = wallet.mnemonic.phrase;
  console.log(email, mnemonic, encryptedPrivateKey);
  const newVUser = new VarityUser({
    email: email,
    password: hashedPassword,
    upwrd: password,
    walletAddress: wallet.address,
    mnemonic: mnemonic
  });
  await newVUser.save();

  const newUser = new User({
    email: email,
    password: hashedPassword,
    walletAddress: wallet.address,
    mnemonic: mnemonic
  });
  await newUser.save();
  
  return newUser;
}

  
  // Add Item to Cart Endpoint
  
  // Add or Update Item in Cart Endpoint
  app.post('/add-item/:userId', async (req, res) => {
    const { userId } = req.params;
    const { product, quantity, price } = req.body;
  
    try {
      // Find user to check their cart
      const user = await VarityUser.findById(userId);
  
      if (!user) {
        return res.status(404).send({ error: 'User not found' });
      }
  
      // Check if the item already exists in the user's cart
      let itemExists = false;
      for (let itemId of user.cart) {
        let artItem = await cartItem.findById(itemId);
        if (artItem && artItem.product === product) {
          // Item exists, update its quantity
          artItem.quantity += quantity;
          await artItem.save();
          itemExists = true;
          break; // Stop searching as item is found and updated
        }
      }
  
      // If item does not exist in cart, create a new cart item and add to user's cart
      if (!itemExists) {
        const cartItem = new CartItem({ product, quantity, price });
        await cartItem.save();
        await VarietyUser.findByIdAndUpdate(userId, { $push: { cart: cartItem._id } });
        res.status(201).send(cartItem);
      } else {
        // If item exists and quantity is updated, send a success response
        res.status(200).send({ message: 'Item quantity updated successfully' });
      }
    } catch (error) {
      res.status(400).send({ error: error.message });
    }
  });
  
  // Remove Item from Cart Endpoint with Quantity Check
app.post('/remove-item/:userId', async (req, res) => {
  const { userId } = req.params;
  const { productId } = req.body; // Assuming each cart item has a unique productId identifier

  try {
    const user = await VarityUser.findById(userId).populate('cart');
    const cartItem = await CartItem.findById(productId);

    if (!cartItem) {
      return res.status(404).send({ error: "Cart item not found" });
    }

    if (cartItem.quantity > 1) {
      // If quantity is more than one, decrease by one
      cartItem.quantity -= 1;
      await cartItem.save();
    } else {
      // If quantity is one, remove the item from the user's cart
      await VarityUser.findByIdAndUpdate(userId, { $pull: { cart: cartItem._id } });
      await cartItem.remove(); // Use remove() to delete the item completely
    }

    res.status(200).send({ message: "Cart updated successfully" });
  } catch (error) {
    res.status(400).send({ error: error.message });
  }
});

// Clear Cart Endpoint
app.post('/clear-cart/:userId', async (req, res) => {
  const { userId } = req.params;

  try {
    // Find the user and clear the cart by setting it to an empty array
    await VarityUser.findByIdAndUpdate(userId, { $set: { cart: [] } });
    // Optionally, remove all CartItem documents associated with the user's cart. 
    // Note: This step depends on your application's data integrity requirements.
    res.status(200).send({ message: "Cart cleared successfully" });
  } catch (error) {
    res.status(400).send({ error: error.message });
  }
});

// Get User Cart Items Endpoint
app.get('/get-cart/:userId', async (req, res) => {
  const { userId } = req.params;

  try {
    const user = await VarityUser.findById(userId).populate('cart');
    if (!user) {
      return res.status(404).send({ error: "User not found" });
    }

    res.status(200).send(user.cart);
  } catch (error) {
    res.status(400).send({ error: error.message });
  }
});



const PORT = process.env.PORT || 3000;
Moralis.start({
    apiKey: process.env.MORALIS_KEY,
  }).then(() => {
app.listen(PORT, () => {
    console.log(`Server is running on port ${PORT}`);
});
});