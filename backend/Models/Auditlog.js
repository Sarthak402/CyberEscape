const mongoose = require('mongoose');

const auditLogSchema = new mongoose.Schema({
  userId:      { type: mongoose.Schema.Types.ObjectId, ref: 'User', default: null },
  fileId:      { type: mongoose.Schema.Types.ObjectId, ref: 'File', default: null },
  filename:    { type: String, default: '' },
  action:      {
    type: String,
    enum: ['UPLOAD', 'DOWNLOAD', 'DOWNLOAD_SHARED', 'WRONG_KEY', 'SHARE_LINK_OPENED', 'SHARE_GENERATED', 'DELETE', 'BRUTE_FORCE_LOCKED'],
    required: true,
  },
  ip:          { type: String, default: 'unknown' },
  details:     { type: String, default: '' },
  success:     { type: Boolean, default: true },
}, { timestamps: true });

module.exports = mongoose.model('AuditLog', auditLogSchema);