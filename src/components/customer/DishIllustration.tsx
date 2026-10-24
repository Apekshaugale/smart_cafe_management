import React from 'react';

interface DishIllustrationProps {
  category: string;
  name: string;
  imageUrl?: string;
}

export const DishIllustration: React.FC<DishIllustrationProps> = ({ category, name, imageUrl }) => {
  if (imageUrl) {
    return (
      <img
        src={imageUrl}
        alt={name}
        className="w-full h-full object-cover"
        referrerPolicy="no-referrer"
        onError={(e) => {
          // If image fails to load, hide image and fallback to SVG
          (e.target as HTMLElement).style.display = 'none';
        }}
      />
    );
  }

  // Return tailored SVG vector food graphics based on name & category
  const lowerName = name.toLowerCase();

  if (lowerName.includes('cappuccino') || lowerName.includes('macchiato')) {
    return (
      <div className="w-full h-full flex items-center justify-center bg-gradient-to-br from-amber-100/70 via-amber-50 to-orange-100/50">
        <svg viewBox="0 0 100 100" className="w-20 h-20 text-amber-800" fill="none">
          {/* Saucer */}
          <ellipse cx="50" cy="78" rx="34" ry="8" fill="#d97706" opacity="0.25" />
          <ellipse cx="50" cy="76" rx="30" ry="6" fill="#fef3c7" stroke="#b45309" strokeWidth="2" />
          {/* Cup */}
          <path d="M26 44 C26 70 34 74 50 74 C66 74 74 70 74 44 Z" fill="#ffffff" stroke="#b45309" strokeWidth="2.5" />
          {/* Coffee Surface */}
          <ellipse cx="50" cy="44" rx="24" ry="7" fill="#78350f" />
          {/* Latte Art Heart */}
          <path d="M50 47 C46 41 40 43 42 46 C44 49 50 51 50 51 C50 51 56 49 58 46 C60 43 54 41 50 47 Z" fill="#fef3c7" />
          {/* Handle */}
          <path d="M72 48 C82 48 84 62 70 65" stroke="#b45309" strokeWidth="2.5" fill="none" strokeLinecap="round" />
          {/* Steam wisps */}
          <path d="M42 32 Q40 24 45 18" stroke="#d97706" strokeWidth="1.5" strokeLinecap="round" opacity="0.7" />
          <path d="M54 30 Q57 22 52 16" stroke="#d97706" strokeWidth="1.5" strokeLinecap="round" opacity="0.7" />
        </svg>
      </div>
    );
  }

  if (lowerName.includes('cold') || category === 'Cold Brew') {
    return (
      <div className="w-full h-full flex items-center justify-center bg-gradient-to-br from-amber-50 via-slate-50 to-orange-50">
        <svg viewBox="0 0 100 100" className="w-20 h-20 text-amber-900" fill="none">
          {/* Glass */}
          <path d="M34 24 L38 82 C38 86 62 86 62 82 L66 24 Z" fill="#ffffff" stroke="#92400e" strokeWidth="2.5" />
          {/* Chilled liquid */}
          <path d="M36 36 L39 80 C39 83 61 83 61 80 L64 36 Z" fill="#78350f" opacity="0.85" />
          {/* Ice Cubes */}
          <rect x="42" y="42" width="12" height="12" rx="2" fill="#fed7aa" opacity="0.8" />
          <rect x="46" y="58" width="11" height="11" rx="2" fill="#ffedd5" opacity="0.7" />
          {/* Straw */}
          <line x1="58" y1="12" x2="48" y2="76" stroke="#ea580c" strokeWidth="3" strokeLinecap="round" />
          {/* Condensation dots */}
          <circle cx="37" cy="48" r="1.5" fill="#d97706" />
          <circle cx="63" cy="56" r="1.5" fill="#d97706" />
        </svg>
      </div>
    );
  }

  if (lowerName.includes('sandwich') || lowerName.includes('panini')) {
    return (
      <div className="w-full h-full flex items-center justify-center bg-gradient-to-br from-emerald-50 via-amber-50 to-orange-50">
        <svg viewBox="0 0 100 100" className="w-20 h-20" fill="none">
          {/* Board */}
          <rect x="18" y="70" width="64" height="6" rx="3" fill="#b45309" opacity="0.3" />
          {/* Bottom Bread */}
          <polygon points="22,65 78,65 50,38" fill="#d97706" stroke="#92400e" strokeWidth="2" />
          {/* Fillings: Lettuce, Tomato, Cheese */}
          <path d="M24 63 Q36 60 48 64 Q60 61 76 63" stroke="#16a34a" strokeWidth="3" strokeLinecap="round" />
          <path d="M28 58 Q40 55 52 59 Q64 56 72 58" stroke="#dc2626" strokeWidth="3" strokeLinecap="round" />
          <path d="M32 53 Q45 50 68 53" stroke="#facc15" strokeWidth="3.5" strokeLinecap="round" />
          {/* Top Bread */}
          <polygon points="26,48 74,48 50,26" fill="#fde68a" stroke="#92400e" strokeWidth="2" />
          {/* Grill marks */}
          <line x1="38" y1="46" x2="44" y2="34" stroke="#78350f" strokeWidth="1.5" />
          <line x1="52" y1="46" x2="56" y2="34" stroke="#78350f" strokeWidth="1.5" />
        </svg>
      </div>
    );
  }

  if (lowerName.includes('toast') || category === 'Breakfast' || lowerName.includes('waffle')) {
    return (
      <div className="w-full h-full flex items-center justify-center bg-gradient-to-br from-yellow-50 via-amber-50 to-emerald-50">
        <svg viewBox="0 0 100 100" className="w-20 h-20" fill="none">
          {/* Plate */}
          <circle cx="50" cy="52" r="38" fill="#ffffff" stroke="#cbd5e1" strokeWidth="2" />
          <circle cx="50" cy="52" r="30" fill="#f8fafc" />
          {/* Toast */}
          <rect x="30" y="34" width="40" height="36" rx="6" fill="#fde68a" stroke="#b45309" strokeWidth="2" />
          {/* Avocado Spread */}
          <path d="M34 42 C38 38 46 44 54 40 C62 42 66 48 64 56 C62 64 42 66 36 60 Z" fill="#65a30d" />
          {/* Poached egg */}
          <circle cx="50" cy="50" r="10" fill="#ffffff" stroke="#e2e8f0" strokeWidth="1" />
          <circle cx="50" cy="50" r="5" fill="#f59e0b" />
          {/* Seasoning flakes */}
          <circle cx="44" cy="46" r="1" fill="#dc2626" />
          <circle cx="56" cy="53" r="1" fill="#dc2626" />
          <circle cx="48" cy="57" r="1" fill="#15803d" />
        </svg>
      </div>
    );
  }

  if (lowerName.includes('pizza') || lowerName.includes('penne') || category === 'Mains') {
    return (
      <div className="w-full h-full flex items-center justify-center bg-gradient-to-br from-red-50 via-amber-50 to-orange-50">
        <svg viewBox="0 0 100 100" className="w-20 h-20" fill="none">
          {/* Pizza Slice */}
          <path d="M50 16 L78 76 C62 84 38 84 22 76 Z" fill="#fef08a" stroke="#b45309" strokeWidth="2" />
          {/* Crust */}
          <path d="M22 76 C38 84 62 84 78 76" stroke="#92400e" strokeWidth="5" strokeLinecap="round" />
          {/* Sauce */}
          <path d="M48 24 L72 72 C60 76 40 76 28 72 Z" fill="#ef4444" opacity="0.8" />
          {/* Cheese melt */}
          <path d="M48 28 L68 70 C58 74 42 74 32 70 Z" fill="#fef08a" />
          {/* Basil & Pepperoni / Cherry Tomatoes */}
          <circle cx="48" cy="44" r="5" fill="#dc2626" />
          <circle cx="58" cy="60" r="4.5" fill="#dc2626" />
          <circle cx="38" cy="62" r="4" fill="#dc2626" />
          <ellipse cx="50" cy="56" rx="4" ry="2" fill="#16a34a" />
          <ellipse cx="42" cy="48" rx="3" ry="1.5" fill="#16a34a" />
        </svg>
      </div>
    );
  }

  // Dessert / Cake
  return (
    <div className="w-full h-full flex items-center justify-center bg-gradient-to-br from-pink-50 via-purple-50 to-amber-50">
      <svg viewBox="0 0 100 100" className="w-20 h-20" fill="none">
        {/* Plate */}
        <ellipse cx="50" cy="74" rx="34" ry="8" fill="#f1f5f9" stroke="#cbd5e1" strokeWidth="1.5" />
        {/* Cake Slice */}
        <path d="M26 62 L50 42 L74 62 Z" fill="#78350f" />
        <path d="M26 62 L26 70 L50 78 L50 42 Z" fill="#581c87" />
        <path d="M50 42 L50 78 L74 70 L74 62 Z" fill="#6b21a8" />
        {/* Frosting / Lava layer */}
        <path d="M26 62 Q50 68 74 62 L50 42 Z" fill="#3b0764" />
        {/* Cherry or Berry */}
        <circle cx="50" cy="40" r="5" fill="#e11d48" />
        <path d="M50 35 Q56 28 58 26" stroke="#15803d" strokeWidth="1.5" fill="none" />
      </svg>
    </div>
  );
};
