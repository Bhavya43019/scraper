import mongoose from 'mongoose';

const WishlistItemSchema = new mongoose.Schema(
  {
    title: { type: String, required: true },
    price: { type: Number, default: 0 },
    image: { type: String, default: '' },
    link: { type: String, required: true, trim: true },
    source: { type: String, default: '' }
  },
  { _id: false }
);

const WishlistSchema = new mongoose.Schema(
  {
    userId: { type: String, required: true, unique: true, index: true },
    items: { type: [WishlistItemSchema], default: [] }
  },
  { timestamps: true }
);

export const Wishlist = mongoose.model('Wishlist', WishlistSchema);
