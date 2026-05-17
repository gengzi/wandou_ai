import React from 'react';
import { motion } from 'motion/react';

export default function BackgroundStars() {
  const stars = Array.from({ length: 50 }).map((_, i) => ({
    id: i,
    top: `${Math.random() * 100}%`,
    left: `${Math.random() * 100}%`,
    duration: Math.random() * 3 + 2,
    size: Math.random() * 2 + 1,
  }));

  return (
    <div className="wandou-background-stars fixed inset-0 pointer-events-none overflow-hidden z-0">
      {stars.map((star) => (
        <motion.div
          key={star.id}
          initial={{ opacity: 0.1 }}
          animate={{ opacity: [0.1, 0.8, 0.1] }}
          transition={{
            duration: star.duration,
            repeat: Infinity,
            ease: "easeInOut",
          }}
          className="absolute bg-white rounded-full bg-slate-400"
          style={{
            top: star.top,
            left: star.left,
            width: `${star.size}px`,
            height: `${star.size}px`,
          }}
        />
      ))}
    </div>
  );
}
