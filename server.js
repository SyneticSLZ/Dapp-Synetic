require('dotenv').config();
const express = require('express');
const mongoose = require('mongoose');
const Moralis = require("moralis").default;
const bcrypt = require('bcryptjs');
const CryptoJS = require('crypto-js');
const { ethers } = require('ethers');
const User = require('./models/User');

mongoose.connect(process.env.MONGODB_URI, { useNewUrlParser: true, useUnifiedTopology: true })
    .then(() => console.log('MongoDB connected'))
    .catch(err => console.error('MongoDB connection error:', err));

const app = express();
const cors = require("cors");
app.use(cors());
app.use(express.json());

const authenticateAPIKey = (req, res, next) => {
    const apiKey = req.headers['x-api-key'];
    if (!apiKey || apiKey !== process.env.API_KEY) {
        return res.status(401).json({ success: false, message: 'Invalid API Key' });
    }
    next();
};

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

// create wallet with an Oath key ---- requires production grade encryption
app.post('/create-wallet-from-Oath', authenticateAPIKey, async (req, res) => {
    try {

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
    } catch (error) {
        console.error('Login Error:', error);
        res.status(500).json({ success: false, message: 'Internal server error' });
    }
});

// fetch-nft-data
app.post('/fetch-nft-data', authenticateAPIKey, async (req, res) => {
    try {
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

    } catch (error) {
        console.error('Create Wallet Error:', error);
        res.status(500).json({ success: false, message: 'Internal server error' });
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