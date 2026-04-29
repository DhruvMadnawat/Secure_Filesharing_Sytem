import mongoose from 'mongoose';

const FileSchema = new mongoose.Schema({
  filename: {
    type: String,
    required: true,
  },
  storedName: {
    type: String,
    required: true,
    unique: true,
  },
  mimeType: {
    type: String,
  },
  ownerId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true,
  },
  accessList: [{
    userId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User'
    },
    encryptedAesKey: {
      type: String,
      required: true,
    }
  }],
}, { timestamps: true });

export default mongoose.model('File', FileSchema);
