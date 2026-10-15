const mongoose = require('mongoose');

const fileSchema = new mongoose.Schema(
  {
    userId:          { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
    filename:        { type: String, required: true },
    originalName:    { type: String, required: true },
    iv:              { type: String, required: true },
    secretKey:       { type: String, required: true },
    expiresAt:       { type: Date,   default: null },
    shareToken:      { type: String,  unique: true, sparse: true },
    shareExpiresAt:  { type: Date,   default: null },
    oneTimeDownload: { type: Boolean, default: false },
  },
  { timestamps: true }
);

module.exports = mongoose.model('File', fileSchema);