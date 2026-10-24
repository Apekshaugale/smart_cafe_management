import React, { useState, useRef, useMemo, useEffect } from 'react';
import { MenuItem, CafeTable, CafeOrder, OrderStatus } from '../../types/cafe';
import {
  UtensilsCrossed,
  Layers,
  BarChart3,
  QrCode,
  CheckCircle2,
  Clock,
  ChefHat,
  XCircle,
  Plus,
  Trash2,
  Edit2,
  Lock,
  LogOut,
  AlertTriangle,
  FileSpreadsheet,
  Camera,
  Upload,
  RotateCcw,
  Image as ImageIcon,
  ArrowLeft,
  SwitchCamera,
  Check,
  Search,
  Filter,
  DollarSign,
  Coffee,
  CheckCircle,
  ChevronRight,
  Sparkles,
  Eye,
  EyeOff,
  KeyRound,
  ShieldAlert,
} from 'lucide-react';
import {
  compressImageToDataUrl,
  isAdminSessionAuthenticated,
  loginAdminOnServer,
  logoutAdminOnServer,
  verifyAdminSessionOnServer,
  changeAdminPasswordOnServer,
} from '../../utils/storageSync';
import { formatCurrency } from '../../utils/cafeUtils';

interface AdminDashboardProps {
  menuItems: MenuItem[];
  tables: CafeTable[];
  orders: CafeOrder[];
  onUpdateOrderStatus: (orderId: number, nextStatus: OrderStatus) => void;
  onConfirmPayment?: (orderId: number) => void;
  onCancelOrder: (orderId: number, reason: string) => void;
  onToggleAvailability: (menuItemId: number) => void;
  onUpdateItemPrice: (menuItemId: number, newPrice: number) => void;
  onAddNewMenuItem: (item: Omit<MenuItem, 'menu_item_id'>) => void;
  onDeleteMenuItem: (menuItemId: number) => void;
  onReleaseTable: (tableId: number) => void;
  onOpenTableQr: (tableNumber: number) => void;
  onExitToCustomerMenu?: () => void;
}

export const AdminDashboard: React.FC<AdminDashboardProps> = ({
  menuItems,
  tables,
  orders,
  onUpdateOrderStatus,
  onConfirmPayment,
  onCancelOrder,
  onToggleAvailability,
  onUpdateItemPrice,
  onAddNewMenuItem,
  onDeleteMenuItem,
  onReleaseTable,
  onOpenTableQr,
  onExitToCustomerMenu,
}) => {
  // Security & Authentication state (Protected on server with sessions & secure password hash)
  const [isAuthenticated, setIsAuthenticated] = useState<boolean>(() => isAdminSessionAuthenticated());
  const [passwordInput, setPasswordInput] = useState<string>('');
  const [showPassword, setShowPassword] = useState<boolean>(false);
  const [authError, setAuthError] = useState<string | null>(null);
  const [isLoggingIn, setIsLoggingIn] = useState<boolean>(false);
  const [failedAttempts, setFailedAttempts] = useState<number>(0);
  const [isLockedOut, setIsLockedOut] = useState<boolean>(false);

  // Change Password Modal State
  const [isChangePassModalOpen, setIsChangePassModalOpen] = useState<boolean>(false);
  const [currentPassInput, setCurrentPassInput] = useState<string>('');
  const [newPassInput, setNewPassInput] = useState<string>('');
  const [confirmPassInput, setConfirmPassInput] = useState<string>('');
  const [changePassError, setChangePassError] = useState<string | null>(null);
  const [changePassSuccess, setChangePassSuccess] = useState<string | null>(null);

  // Verify server session on mount
  useEffect(() => {
    if (isAdminSessionAuthenticated()) {
      verifyAdminSessionOnServer().then((valid) => {
        setIsAuthenticated(valid);
      });
    }
  }, []);

  // Active Admin Sub-tab
  const [adminTab, setAdminTab] = useState<'menu' | 'orders' | 'tables' | 'reports'>('menu');

  // Filter for orders queue
  const [orderFilter, setOrderFilter] = useState<string>('ALL');

  // Menu Search & Filter States
  const [menuSearch, setMenuSearch] = useState<string>('');
  const [selectedCategory, setSelectedCategory] = useState<string>('ALL');
  const [stockFilter, setStockFilter] = useState<'ALL' | 'IN_STOCK' | 'OUT_OF_STOCK'>('ALL');

  // Floor selection for table grid
  const [selectedFloor, setSelectedFloor] = useState<'Floor 1 (Inside)' | 'Floor 2 (Terrace)'>('Floor 1 (Inside)');

  // New Menu Item Modal State
  const [isAddModalOpen, setIsAddModalOpen] = useState<boolean>(false);
  const [newItemName, setNewItemName] = useState<string>('');
  const [newItemCategory, setNewItemCategory] = useState<MenuItem['category']>('Coffee');
  const [newItemPrice, setNewItemPrice] = useState<number>(120);
  const [newItemDescription, setNewItemDescription] = useState<string>('');
  const [newItemIsVeg, setNewItemIsVeg] = useState<boolean>(true);
  const [newItemImage, setNewItemImage] = useState<string | null>(null);
  const [isProcessingImage, setIsProcessingImage] = useState<boolean>(false);
  const [formError, setFormError] = useState<string | null>(null);

  // Camera capture state inside Add Item modal
  const [isCameraActive, setIsCameraActive] = useState<boolean>(false);
  const [cameraFacingMode, setCameraFacingMode] = useState<'environment' | 'user'>('environment');
  const [cameraError, setCameraError] = useState<string | null>(null);
  const videoRef = useRef<HTMLVideoElement | null>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const fileInputCameraRef = useRef<HTMLInputElement | null>(null);
  const fileInputGalleryRef = useRef<HTMLInputElement | null>(null);

  // Quick edit price state
  const [editingItemId, setEditingItemId] = useState<number | null>(null);
  const [tempPrice, setTempPrice] = useState<number>(0);

  // Filtered menu items calculation
  const filteredMenuItems = useMemo(() => {
    return menuItems.filter((item) => {
      const matchesSearch =
        menuSearch.trim() === '' ||
        item.item_name.toLowerCase().includes(menuSearch.toLowerCase()) ||
        item.description.toLowerCase().includes(menuSearch.toLowerCase());

      const matchesCat = selectedCategory === 'ALL' || item.category === selectedCategory;

      const matchesStock =
        stockFilter === 'ALL' ||
        (stockFilter === 'IN_STOCK' && item.available === 'Y') ||
        (stockFilter === 'OUT_OF_STOCK' && item.available === 'N');

      return matchesSearch && matchesCat && matchesStock;
    });
  }, [menuItems, menuSearch, selectedCategory, stockFilter]);

  // Order counts per status
  const orderCounts = useMemo(() => {
    const counts: Record<string, number> = {
      ALL: orders.length,
      PLACED: 0,
      PREPARING: 0,
      READY: 0,
      COMPLETED: 0,
      CANCELLED: 0,
    };
    orders.forEach((o) => {
      if (counts[o.order_status] !== undefined) {
        counts[o.order_status]++;
      }
    });
    return counts;
  }, [orders]);

  // Filtered orders queue
  const filteredOrders = useMemo(() => {
    if (orderFilter === 'ALL') return orders;
    return orders.filter((o) => o.order_status === orderFilter);
  }, [orders, orderFilter]);

  // Categories list
  const categories: Array<MenuItem['category']> = [
    'Coffee',
    'Cold Brew',
    'Breakfast',
    'Snacks',
    'Mains',
    'Desserts',
  ];

  // Start live webcam / camera stream
  const startCamera = async (facing: 'environment' | 'user' = cameraFacingMode) => {
    stopCamera();
    setCameraError(null);
    try {
      if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) {
        throw new Error('Camera access is not supported on this browser.');
      }
      const stream = await navigator.mediaDevices.getUserMedia({
        video: {
          facingMode: { ideal: facing },
          width: { ideal: 1280 },
          height: { ideal: 720 },
        },
      });
      streamRef.current = stream;
      setIsCameraActive(true);
      setTimeout(() => {
        if (videoRef.current) {
          videoRef.current.srcObject = stream;
          videoRef.current.play().catch((e) => console.log('Video play err:', e));
        }
      }, 150);
    } catch (err: any) {
      console.warn('Camera error:', err);
      setCameraError(
        err.name === 'NotAllowedError' || err.name === 'PermissionDeniedError'
          ? 'Camera permission denied. Please allow camera access in browser settings or use the Direct Device Camera button below.'
          : err.message || 'Could not open camera viewfinder.'
      );
    }
  };

  const toggleCameraFacing = () => {
    const next = cameraFacingMode === 'environment' ? 'user' : 'environment';
    setCameraFacingMode(next);
    if (isCameraActive) {
      startCamera(next);
    }
  };

  const stopCamera = () => {
    if (streamRef.current) {
      streamRef.current.getTracks().forEach((track) => track.stop());
      streamRef.current = null;
    }
    setIsCameraActive(false);
  };

  const captureSnapshot = async () => {
    if (!videoRef.current) return;
    setIsProcessingImage(true);
    try {
      const canvas = document.createElement('canvas');
      canvas.width = videoRef.current.videoWidth || 640;
      canvas.height = videoRef.current.videoHeight || 480;
      const ctx = canvas.getContext('2d');
      if (ctx) {
        ctx.drawImage(videoRef.current, 0, 0, canvas.width, canvas.height);
        canvas.toBlob(
          async (blob) => {
            if (blob) {
              const compressed = await compressImageToDataUrl(blob, 700, 0.82);
              setNewItemImage(compressed);
            }
            setIsProcessingImage(false);
            stopCamera();
          },
          'image/jpeg',
          0.85
        );
      }
    } catch (e) {
      console.error('Error capturing snapshot:', e);
      setIsProcessingImage(false);
      stopCamera();
    }
  };

  // Native mobile camera or file picker upload
  const handleNativeFileSelect = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      setIsProcessingImage(true);
      try {
        const compressed = await compressImageToDataUrl(file, 700, 0.82);
        setNewItemImage(compressed);
      } catch (err) {
        console.error('Failed to process image:', err);
      } finally {
        setIsProcessingImage(false);
      }
    }
  };

  const handleCloseAddModal = () => {
    stopCamera();
    setIsAddModalOpen(false);
    setNewItemImage(null);
    setFormError(null);
  };

  // Secure Login handler via server authentication
  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    if (isLockedOut || isLoggingIn) return;
    setIsLoggingIn(true);
    setAuthError(null);

    const result = await loginAdminOnServer(passwordInput.trim());
    setIsLoggingIn(false);

    if (result.success) {
      setIsAuthenticated(true);
      setAuthError(null);
      setPasswordInput('');
      setFailedAttempts(0);
    } else {
      const nextFails = failedAttempts + 1;
      setFailedAttempts(nextFails);
      if (nextFails >= 5) {
        setIsLockedOut(true);
        setAuthError('Too many failed attempts. Security lockout active for 30 seconds.');
        setTimeout(() => {
          setIsLockedOut(false);
          setFailedAttempts(0);
          setAuthError(null);
        }, 30000);
      } else {
        setAuthError(
          result.error || `Incorrect administrator password. Access denied. (${5 - nextFails} attempts remaining)`
        );
      }
    }
  };

  const handleLogout = async () => {
    await logoutAdminOnServer();
    setIsAuthenticated(false);
    setPasswordInput('');
    setAuthError(null);
  };

  const handleChangePassword = async (e: React.FormEvent) => {
    e.preventDefault();
    setChangePassError(null);
    setChangePassSuccess(null);

    if (newPassInput.trim().length < 4) {
      setChangePassError('New password must be at least 4 characters.');
      return;
    }
    if (newPassInput !== confirmPassInput) {
      setChangePassError('New password and confirmation do not match.');
      return;
    }

    const res = await changeAdminPasswordOnServer(currentPassInput.trim(), newPassInput.trim());
    if (res.success) {
      setChangePassSuccess('Password successfully updated and secured on server!');
      setCurrentPassInput('');
      setNewPassInput('');
      setConfirmPassInput('');
      setTimeout(() => {
        setIsChangePassModalOpen(false);
        setChangePassSuccess(null);
      }, 1600);
    } else {
      setChangePassError(res.error || 'Failed to update administrator password.');
    }
  };

  const handleCreateMenuItem = (e: React.FormEvent) => {
    e.preventDefault();
    if (!newItemName.trim()) {
      setFormError('Item name is required.');
      return;
    }
    if (newItemPrice < 0) {
      setFormError('Price cannot be negative.');
      return;
    }
    onAddNewMenuItem({
      item_name: newItemName.trim(),
      category: newItemCategory,
      price: Number(newItemPrice),
      available: 'Y',
      description: newItemDescription.trim() || 'Freshly prepared specialty dish.',
      isVeg: newItemIsVeg,
      prepTimeMinutes: 8,
      calories: 220,
      imageUrl: newItemImage || undefined,
    });
    handleCloseAddModal();
    setNewItemName('');
    setNewItemDescription('');
    setNewItemPrice(120);
  };

  if (!isAuthenticated) {
    return (
      <div className="max-w-md mx-auto my-8 sm:my-16 px-4">
        <div className="bg-white rounded-2xl shadow-xl border border-slate-200 p-6 sm:p-8">
          <div className="w-14 h-14 rounded-2xl bg-amber-50 border border-amber-200 flex items-center justify-center text-amber-700 mx-auto mb-4 shadow-xs">
            <Lock className="w-7 h-7" />
          </div>

          <div className="text-center">
            <span className="inline-block px-2.5 py-0.5 bg-amber-100 text-amber-900 font-bold text-[10px] uppercase tracking-wider rounded-full mb-1">
              Restricted Area · Staff Only
            </span>
            <h2 className="text-xl font-extrabold text-slate-900">Admin & Kitchen Security Gate</h2>
            <p className="text-xs text-slate-500 mt-1 max-w-xs mx-auto">
              Please authenticate with your cafe administrator password to view customer orders, revenue, and menu controls.
            </p>
          </div>

          {authError && (
            <div className="mt-4 p-3 bg-red-50 border border-red-200 rounded-xl text-xs text-red-700 flex items-start gap-2">
              <AlertTriangle className="w-4 h-4 text-red-600 shrink-0 mt-0.5" />
              <span>{authError}</span>
            </div>
          )}

          <form onSubmit={handleLogin} className="mt-6 space-y-4">
            <div>
              <label className="block text-xs font-bold text-slate-700 mb-1">
                Admin Password
              </label>
              <div className="relative">
                <input
                  type={showPassword ? 'text' : 'password'}
                  value={passwordInput}
                  onChange={(e) => setPasswordInput(e.target.value)}
                  disabled={isLockedOut}
                  className="w-full pl-3 pr-10 py-2.5 text-sm bg-slate-50 border border-slate-200 rounded-xl text-slate-900 focus:bg-white focus:outline-none focus:ring-2 focus:ring-amber-500 disabled:opacity-50"
                  placeholder="Enter administrator password"
                  autoFocus
                  required
                />
                <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 p-1 cursor-pointer"
                  title={showPassword ? 'Hide password' : 'Show password'}
                >
                  {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                </button>
              </div>
            </div>

            <button
              type="submit"
              disabled={isLockedOut}
              className="w-full py-2.5 bg-amber-600 hover:bg-amber-700 disabled:bg-slate-300 text-white font-bold text-sm rounded-xl shadow-xs transition-colors cursor-pointer flex items-center justify-center gap-1.5"
            >
              <Lock className="w-4 h-4" />
              <span>Unlock Admin Console</span>
            </button>
          </form>

          <div className="mt-5 pt-4 border-t border-slate-100 flex flex-col items-center gap-3">
            <p className="text-[11px] text-slate-400 text-center">
              Customer private data, phone numbers, and financial reports are encrypted and protected.
            </p>

            {onExitToCustomerMenu && (
              <button
                type="button"
                onClick={onExitToCustomerMenu}
                className="w-full py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 font-semibold text-xs rounded-xl transition-colors cursor-pointer flex items-center justify-center gap-1.5"
              >
                <ArrowLeft className="w-3.5 h-3.5" />
                <span>Return to Customer Food Menu</span>
              </button>
            )}

            <div className="p-2 bg-slate-50 border border-slate-200 rounded-lg text-[10px] text-slate-500 text-center w-full flex items-center justify-center gap-1.5">
              <Lock className="w-3 h-3 text-slate-400" />
              <span>Protected Staff Portal • Authenticate with your administrator password</span>
            </div>
          </div>
        </div>
      </div>
    );
  }

  // Calculate live statistics
  const totalRevenue = orders
    .filter((o) => o.order_status !== 'CANCELLED')
    .reduce((sum, o) => sum + o.total_amount, 0);

  const activeOrders = orders.filter((o) => ['PLACED', 'PREPARING', 'READY'].includes(o.order_status));
  const occupiedTables = tables.filter((t) => t.status === 'OCCUPIED').length;

  return (
    <div className="max-w-7xl mx-auto px-3 sm:px-6 lg:px-8 py-4 sm:py-6 space-y-4 sm:space-y-6">
      {/* Top Bar with Live Sync Status & Responsive Actions */}
      <div className="bg-white p-4 sm:p-5 rounded-2xl border border-slate-200 shadow-xs flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2">
            <span className="relative flex h-2 w-2">
              <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75"></span>
              <span className="relative inline-flex rounded-full h-2 w-2 bg-emerald-500"></span>
            </span>
            <span className="text-[11px] font-bold text-emerald-700 uppercase tracking-wider">
              Cross-Device Live Sync Active
            </span>
            <span className="text-slate-300 hidden sm:inline">|</span>
            <span className="text-[11px] text-slate-500 hidden sm:inline">
              Changes sync instantly between Phone & Laptop
            </span>
          </div>
          <h1 className="text-xl sm:text-2xl font-black text-slate-900 tracking-tight mt-0.5">
            Admin & Kitchen Management
          </h1>
        </div>

        {/* Action Buttons: Responsive 2x2 Grid on Mobile, Flex on Laptop */}
        <div className="grid grid-cols-2 sm:flex sm:items-center gap-2 pt-2 md:pt-0 border-t md:border-t-0 border-slate-100 w-full sm:w-auto">
          {onExitToCustomerMenu && (
            <button
              onClick={onExitToCustomerMenu}
              className="flex items-center justify-center gap-1.5 px-3 py-2 bg-slate-900 hover:bg-slate-800 text-white rounded-xl text-xs font-semibold shadow-xs transition-colors cursor-pointer active:scale-95"
            >
              <ArrowLeft className="w-3.5 h-3.5" />
              <span>Customer View</span>
            </button>
          )}

          <button
            onClick={() => setIsAddModalOpen(true)}
            className="flex items-center justify-center gap-1.5 px-3.5 py-2 bg-amber-600 hover:bg-amber-700 text-white rounded-xl text-xs font-bold shadow-xs transition-colors cursor-pointer active:scale-95"
          >
            <Camera className="w-4 h-4" />
            <span className="hidden sm:inline">Add Item with Photo</span>
            <span className="sm:hidden">Add Dish</span>
          </button>

          <button
            onClick={() => setIsChangePassModalOpen(true)}
            className="flex items-center justify-center gap-1.5 px-3 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-xl text-xs font-semibold transition-colors cursor-pointer active:scale-95"
            title="Change Administrator Password"
          >
            <KeyRound className="w-3.5 h-3.5 text-amber-700" />
            <span className="hidden sm:inline">Change Password</span>
            <span className="sm:hidden">Password</span>
          </button>

          <button
            onClick={handleLogout}
            className="flex items-center justify-center gap-1.5 px-3 py-2 bg-slate-100 hover:bg-red-50 hover:text-red-700 text-slate-700 rounded-xl text-xs font-semibold transition-colors cursor-pointer active:scale-95"
            title="Lock Console & Sign Out"
          >
            <Lock className="w-3.5 h-3.5" />
            <span className="hidden sm:inline">Lock Console</span>
            <span className="sm:hidden">Lock</span>
          </button>
        </div>
      </div>

      {/* KPI Cards: 2 Columns on Mobile, 4 Columns on Laptop */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-2.5 sm:gap-4">
        <div className="bg-white p-3.5 sm:p-4 rounded-xl border border-slate-200 shadow-xs">
          <span className="text-[10px] sm:text-[11px] font-bold text-slate-400 uppercase tracking-wider block">
            Today's Sales
          </span>
          <div className="flex items-baseline gap-1 mt-0.5">
            <span className="text-xl sm:text-2xl font-black text-slate-900 tabular-nums">
              {formatCurrency(totalRevenue)}
            </span>
          </div>
          <span className="text-[10px] sm:text-[11px] text-emerald-700 font-semibold mt-0.5 block truncate">
            {orders.length} orders received
          </span>
        </div>

        <div className="bg-white p-3.5 sm:p-4 rounded-xl border border-slate-200 shadow-xs">
          <span className="text-[10px] sm:text-[11px] font-bold text-slate-400 uppercase tracking-wider block">
            Active Orders
          </span>
          <div className="flex items-baseline gap-1 mt-0.5">
            <span className="text-xl sm:text-2xl font-black text-amber-600 tabular-nums">
              {activeOrders.length}
            </span>
          </div>
          <span className="text-[10px] sm:text-[11px] text-slate-500 font-medium mt-0.5 block truncate">
            In kitchen queue
          </span>
        </div>

        <div className="bg-white p-3.5 sm:p-4 rounded-xl border border-slate-200 shadow-xs">
          <span className="text-[10px] sm:text-[11px] font-bold text-slate-400 uppercase tracking-wider block">
            Seated Tables
          </span>
          <div className="flex items-baseline gap-1 mt-0.5">
            <span className="text-xl sm:text-2xl font-black text-slate-900 tabular-nums">
              {occupiedTables}/{tables.length}
            </span>
          </div>
          <span className="text-[10px] sm:text-[11px] text-slate-500 font-medium mt-0.5 block truncate">
            {Math.round((occupiedTables / (tables.length || 1)) * 100)}% occupancy
          </span>
        </div>

        <div className="bg-white p-3.5 sm:p-4 rounded-xl border border-slate-200 shadow-xs">
          <span className="text-[10px] sm:text-[11px] font-bold text-slate-400 uppercase tracking-wider block">
            Menu Dishes
          </span>
          <div className="flex items-baseline gap-1 mt-0.5">
            <span className="text-xl sm:text-2xl font-black text-slate-900 tabular-nums">
              {menuItems.length}
            </span>
          </div>
          <span className="text-[10px] sm:text-[11px] text-emerald-700 font-semibold mt-0.5 block truncate">
            {menuItems.filter((i) => i.available === 'Y').length} in stock
          </span>
        </div>
      </div>

      {/* Sub Navigation Segmented Control: Responsive labels & smooth touch scrolling */}
      <div className="bg-slate-200/80 p-1 rounded-xl flex items-center gap-1 overflow-x-auto no-scrollbar touch-pan-x">
        {[
          {
            id: 'menu',
            label: 'Menu Management',
            shortLabel: 'Menu',
            badge: menuItems.length,
            icon: UtensilsCrossed,
          },
          {
            id: 'orders',
            label: 'Kitchen KDS',
            shortLabel: 'Kitchen KDS',
            badge: activeOrders.length,
            badgeColor: activeOrders.length > 0 ? 'bg-amber-600 text-white' : 'bg-slate-200 text-slate-700',
            icon: Clock,
          },
          {
            id: 'tables',
            label: 'Tables & QR',
            shortLabel: 'Tables',
            badge: occupiedTables,
            icon: Layers,
          },
          {
            id: 'reports',
            label: 'Sales Reports',
            shortLabel: 'Reports',
            icon: BarChart3,
          },
        ].map((tab) => {
          const Icon = tab.icon;
          const isActive = adminTab === tab.id;
          return (
            <button
              key={tab.id}
              onClick={() => setAdminTab(tab.id as any)}
              className={`flex-1 sm:flex-none flex items-center justify-center gap-1.5 px-3 py-2 rounded-lg text-xs font-bold transition-all whitespace-nowrap cursor-pointer active:scale-95 ${
                isActive
                  ? 'bg-white text-slate-900 shadow-xs'
                  : 'text-slate-600 hover:text-slate-900 hover:bg-white/40'
              }`}
            >
              <Icon className="w-3.5 h-3.5 shrink-0" />
              <span className="sm:hidden">{tab.shortLabel}</span>
              <span className="hidden sm:inline">{tab.label}</span>
              {tab.badge !== undefined && (
                <span
                  className={`px-1.5 py-0.2 rounded-full text-[10px] font-black shrink-0 ${
                    tab.badgeColor || (isActive ? 'bg-amber-100 text-amber-800' : 'bg-slate-300 text-slate-700')
                  }`}
                >
                  {tab.badge}
                </span>
              )}
            </button>
          );
        })}
      </div>

      {/* ======================================================== */}
      {/* TAB 1: MENU MANAGEMENT (FULLY RESPONSIVE FOR MOBILE & LAPTOP) */}
      {/* ======================================================== */}
      {adminTab === 'menu' && (
        <div className="space-y-4">
          {/* Search, Category Filters, and Quick Add Bar */}
          <div className="bg-white p-3.5 sm:p-4 rounded-xl border border-slate-200 shadow-xs space-y-3">
            <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3">
              {/* Search Box */}
              <div className="relative flex-1">
                <Search className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
                <input
                  type="text"
                  value={menuSearch}
                  onChange={(e) => setMenuSearch(e.target.value)}
                  placeholder="Search dishes by name or description..."
                  className="w-full pl-9 pr-3 py-2 bg-slate-50 border border-slate-200 rounded-lg text-xs sm:text-sm text-slate-900 placeholder-slate-400 focus:bg-white focus:outline-none focus:ring-2 focus:ring-amber-500"
                />
                {menuSearch && (
                  <button
                    onClick={() => setMenuSearch('')}
                    className="absolute right-2.5 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 text-xs p-1"
                  >
                    Clear
                  </button>
                )}
              </div>

              {/* Stock Filter & Add Item Button */}
              <div className="flex items-center gap-2">
                <select
                  value={stockFilter}
                  onChange={(e) => setStockFilter(e.target.value as any)}
                  className="px-2.5 py-2 bg-slate-50 border border-slate-200 rounded-lg text-xs font-semibold text-slate-700 focus:bg-white focus:outline-none focus:ring-2 focus:ring-amber-500 cursor-pointer"
                >
                  <option value="ALL">All Stock Status</option>
                  <option value="IN_STOCK">In Stock Only</option>
                  <option value="OUT_OF_STOCK">Out of Stock Only</option>
                </select>

                <button
                  onClick={() => setIsAddModalOpen(true)}
                  className="flex items-center gap-1.5 px-3.5 py-2 bg-amber-600 hover:bg-amber-700 text-white rounded-lg text-xs font-bold shadow-xs transition-colors shrink-0 cursor-pointer"
                >
                  <Camera className="w-3.5 h-3.5" />
                  <span className="hidden sm:inline">Add Dish with Camera</span>
                  <span className="sm:hidden">Add Dish</span>
                </button>
              </div>
            </div>

            {/* Horizontal Scrollable Category Pills */}
            <div className="flex items-center gap-1.5 overflow-x-auto no-scrollbar pt-1">
              <button
                onClick={() => setSelectedCategory('ALL')}
                className={`px-3 py-1 rounded-full text-xs font-semibold transition-colors cursor-pointer shrink-0 ${
                  selectedCategory === 'ALL'
                    ? 'bg-slate-900 text-white'
                    : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
                }`}
              >
                All Categories ({menuItems.length})
              </button>
              {categories.map((cat) => {
                const count = menuItems.filter((m) => m.category === cat).length;
                return (
                  <button
                    key={cat}
                    onClick={() => setSelectedCategory(cat)}
                    className={`px-3 py-1 rounded-full text-xs font-semibold transition-colors cursor-pointer shrink-0 ${
                      selectedCategory === cat
                        ? 'bg-amber-600 text-white'
                        : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
                    }`}
                  >
                    {cat} ({count})
                  </button>
                );
              })}
            </div>
          </div>

          {/* Results Summary and Count */}
          <div className="flex items-center justify-between text-xs text-slate-500 px-1">
            <span>
              Showing <strong>{filteredMenuItems.length}</strong> of <strong>{menuItems.length}</strong> items
            </span>
            <span className="text-[11px] text-amber-700 font-medium hidden sm:inline">
              Tip: Tap "Edit Price" or "Stock Status" to modify live customer menu
            </span>
          </div>

          {/* 1. MOBILE VIEW: Touch-Friendly Card List (< md screens) */}
          <div className="block md:hidden space-y-3">
            {filteredMenuItems.length === 0 ? (
              <div className="p-8 text-center bg-white rounded-xl border border-slate-200">
                <Coffee className="w-8 h-8 text-slate-300 mx-auto mb-2" />
                <p className="text-sm font-semibold text-slate-700">No matching dishes found</p>
                <p className="text-xs text-slate-400 mt-1">Try adjusting your search query or filters.</p>
              </div>
            ) : (
              filteredMenuItems.map((item) => {
                const isItemEditing = editingItemId === item.menu_item_id;

                return (
                  <div
                    key={item.menu_item_id}
                    className="bg-white rounded-xl border border-slate-200 p-3.5 shadow-xs space-y-3"
                  >
                    {/* Top Row: Photo, Dish Name, Category, and Delete */}
                    <div className="flex items-start gap-3">
                      {item.imageUrl ? (
                        <img
                          src={item.imageUrl}
                          alt={item.item_name}
                          className="w-16 h-16 rounded-xl object-cover border border-slate-200 shrink-0 shadow-xs"
                        />
                      ) : (
                        <div className="w-16 h-16 rounded-xl bg-amber-50 border border-amber-200 flex items-center justify-center text-amber-700 shrink-0 font-bold text-lg">
                          {item.item_name.charAt(0)}
                        </div>
                      )}

                      <div className="flex-1 min-w-0">
                        <div className="flex items-center justify-between gap-1">
                          <h4 className="font-bold text-slate-900 text-sm truncate flex items-center gap-1.5">
                            <span>{item.item_name}</span>
                            <span
                              className={`w-2 h-2 rounded-full shrink-0 ${
                                item.isVeg ? 'bg-emerald-500' : 'bg-red-500'
                              }`}
                              title={item.isVeg ? 'Veg' : 'Non-Veg'}
                            />
                          </h4>

                          <button
                            onClick={() => onDeleteMenuItem(item.menu_item_id)}
                            className="text-slate-400 hover:text-red-600 p-1 rounded-md hover:bg-red-50 transition-colors cursor-pointer"
                            title="Delete Item"
                          >
                            <Trash2 className="w-4 h-4" />
                          </button>
                        </div>

                        <span className="inline-block mt-0.5 px-2 py-0.5 bg-slate-100 text-slate-600 rounded text-[10px] font-semibold">
                          {item.category}
                        </span>

                        <p className="text-xs text-slate-500 line-clamp-1 mt-1">
                          {item.description}
                        </p>
                      </div>
                    </div>

                    {/* Middle Row: Price Editor Inline */}
                    <div className="flex items-center justify-between pt-2 border-t border-slate-100">
                      <span className="text-xs text-slate-500 font-medium">Item Price:</span>
                      {isItemEditing ? (
                        <div className="flex items-center gap-1.5">
                          <span className="text-xs font-bold text-slate-700">₹</span>
                          <input
                            type="number"
                            min="0"
                            value={tempPrice}
                            onChange={(e) => setTempPrice(Number(e.target.value))}
                            className="w-20 px-2 py-1 border-2 border-amber-500 rounded-lg text-xs font-bold bg-amber-50/50"
                            autoFocus
                          />
                          <button
                            onClick={() => {
                              onUpdateItemPrice(item.menu_item_id, tempPrice);
                              setEditingItemId(null);
                            }}
                            className="px-2.5 py-1 bg-emerald-600 text-white rounded-lg text-xs font-bold cursor-pointer"
                          >
                            Save
                          </button>
                          <button
                            onClick={() => setEditingItemId(null)}
                            className="px-2 py-1 bg-slate-200 text-slate-700 rounded-lg text-xs font-semibold cursor-pointer"
                          >
                            ✕
                          </button>
                        </div>
                      ) : (
                        <div className="flex items-center gap-2">
                          <span className="font-extrabold text-slate-900 text-sm tabular-nums">
                            {formatCurrency(item.price)}
                          </span>
                          <button
                            onClick={() => {
                              setEditingItemId(item.menu_item_id);
                              setTempPrice(item.price);
                            }}
                            className="flex items-center gap-1 px-2 py-1 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-lg text-[11px] font-semibold transition-colors cursor-pointer"
                          >
                            <Edit2 className="w-3 h-3" />
                            <span>Edit</span>
                          </button>
                        </div>
                      )}
                    </div>

                    {/* Bottom Row: Mobile Stock Status Toggle Button */}
                    <button
                      onClick={() => onToggleAvailability(item.menu_item_id)}
                      className={`w-full py-2.5 rounded-xl text-xs font-bold flex items-center justify-center gap-1.5 cursor-pointer transition-colors shadow-xs ${
                        item.available === 'Y'
                          ? 'bg-emerald-50 border border-emerald-300 text-emerald-800 hover:bg-emerald-100'
                          : 'bg-red-50 border border-red-300 text-red-800 hover:bg-red-100'
                      }`}
                    >
                      {item.available === 'Y' ? (
                        <>
                          <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600" />
                          <span>Dish is IN STOCK (Tap to mark Out of Stock)</span>
                        </>
                      ) : (
                        <>
                          <XCircle className="w-3.5 h-3.5 text-red-600" />
                          <span>Dish is OUT OF STOCK (Tap to restock)</span>
                        </>
                      )}
                    </button>
                  </div>
                );
              })
            )}
          </div>

          {/* 2. LAPTOP / DESKTOP VIEW: Spacious Table View (hidden on mobile, block on md+) */}
          <div className="hidden md:block bg-white rounded-xl border border-slate-200 overflow-hidden shadow-xs">
            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs text-slate-700">
                <thead className="bg-slate-50 text-slate-500 uppercase tracking-wider font-semibold border-b border-slate-200">
                  <tr>
                    <th className="py-3 px-4">Photo & Dish Name</th>
                    <th className="py-3 px-4">Category</th>
                    <th className="py-3 px-4">Price (₹)</th>
                    <th className="py-3 px-4">Stock Status</th>
                    <th className="py-3 px-4 text-right">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {filteredMenuItems.length === 0 ? (
                    <tr>
                      <td colSpan={5} className="py-8 text-center text-slate-400">
                        No dishes match the selected search or category filters.
                      </td>
                    </tr>
                  ) : (
                    filteredMenuItems.map((item) => (
                      <tr key={item.menu_item_id} className="hover:bg-slate-50/80 transition-colors">
                        <td className="py-3 px-4">
                          <div className="flex items-center gap-3">
                            {item.imageUrl ? (
                              <img
                                src={item.imageUrl}
                                alt={item.item_name}
                                className="w-12 h-12 rounded-lg object-cover border border-slate-200 shrink-0 shadow-xs"
                              />
                            ) : (
                              <div className="w-12 h-12 rounded-lg bg-amber-50 border border-amber-200 flex items-center justify-center text-amber-700 shrink-0 font-bold text-sm">
                                {item.item_name.charAt(0)}
                              </div>
                            )}
                            <div>
                              <div className="font-bold text-slate-900 flex items-center gap-1.5">
                                <span>{item.item_name}</span>
                                <span
                                  className={`w-2 h-2 rounded-full ${
                                    item.isVeg ? 'bg-emerald-500' : 'bg-red-500'
                                  }`}
                                  title={item.isVeg ? 'Veg' : 'Non-Veg'}
                                />
                              </div>
                              <div className="text-[11px] text-slate-400 truncate max-w-xs">
                                {item.description}
                              </div>
                            </div>
                          </div>
                        </td>
                        <td className="py-3 px-4">
                          <span className="px-2 py-0.5 bg-slate-100 text-slate-700 rounded text-[11px] font-medium">
                            {item.category}
                          </span>
                        </td>
                        <td className="py-3 px-4 font-bold tabular-nums">
                          {editingItemId === item.menu_item_id ? (
                            <div className="flex items-center gap-1">
                              <input
                                type="number"
                                min="0"
                                value={tempPrice}
                                onChange={(e) => setTempPrice(Number(e.target.value))}
                                className="w-16 px-1.5 py-0.5 border border-amber-500 rounded text-xs font-bold"
                              />
                              <button
                                onClick={() => {
                                  onUpdateItemPrice(item.menu_item_id, tempPrice);
                                  setEditingItemId(null);
                                }}
                                className="text-emerald-600 font-bold hover:underline cursor-pointer"
                              >
                                Save
                              </button>
                            </div>
                          ) : (
                            <div className="flex items-center gap-1.5">
                              <span>{formatCurrency(item.price)}</span>
                              <button
                                onClick={() => {
                                  setEditingItemId(item.menu_item_id);
                                  setTempPrice(item.price);
                                }}
                                className="text-slate-400 hover:text-slate-600 p-0.5 cursor-pointer"
                                title="Edit Price"
                              >
                                <Edit2 className="w-3 h-3" />
                              </button>
                            </div>
                          )}
                        </td>
                        <td className="py-3 px-4">
                          <button
                            onClick={() => onToggleAvailability(item.menu_item_id)}
                            className={`px-3 py-1 rounded-md text-[11px] font-bold cursor-pointer transition-colors ${
                              item.available === 'Y'
                                ? 'bg-emerald-100 text-emerald-800 hover:bg-emerald-200'
                                : 'bg-red-100 text-red-800 hover:bg-red-200'
                            }`}
                          >
                            {item.available === 'Y' ? 'In Stock (Y)' : 'Out of Stock (N)'}
                          </button>
                        </td>
                        <td className="py-3 px-4 text-right">
                          <button
                            onClick={() => onDeleteMenuItem(item.menu_item_id)}
                            className="text-slate-400 hover:text-red-600 p-1 rounded hover:bg-red-50 transition-colors cursor-pointer"
                            title="Delete or Deactivate Item"
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                          </button>
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

      {/* ======================================================== */}
      {/* TAB 2: ORDER TRACKING (KDS) - RESPONSIVE FOR MOBILE & LAPTOP */}
      {/* ======================================================== */}
      {adminTab === 'orders' && (
        <div className="space-y-4">
          {/* Status Filter Chips with Dynamic Counts */}
          <div className="bg-white p-2.5 sm:p-3 rounded-xl border border-slate-200 shadow-xs flex items-center gap-1.5 overflow-x-auto no-scrollbar">
            {(
              [
                { id: 'ALL', label: 'All Orders' },
                { id: 'PLACED', label: 'Placed' },
                { id: 'PREPARING', label: 'Preparing' },
                { id: 'READY', label: 'Ready' },
                { id: 'COMPLETED', label: 'Completed' },
                { id: 'CANCELLED', label: 'Cancelled' },
              ] as const
            ).map((st) => {
              const count = orderCounts[st.id] || 0;
              const isSelected = orderFilter === st.id;
              return (
                <button
                  key={st.id}
                  onClick={() => setOrderFilter(st.id)}
                  className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-bold transition-colors cursor-pointer shrink-0 ${
                    isSelected
                      ? 'bg-slate-900 text-white shadow-xs'
                      : 'bg-slate-50 text-slate-600 hover:bg-slate-100 border border-slate-200'
                  }`}
                >
                  <span>{st.label}</span>
                  <span
                    className={`px-1.5 py-0.2 rounded-full text-[10px] font-black ${
                      isSelected
                        ? 'bg-white/20 text-white'
                        : 'bg-slate-200 text-slate-700'
                    }`}
                  >
                    {count}
                  </span>
                </button>
              );
            })}
          </div>

          {/* Orders Grid: 1 col on mobile, 2 cols on tablet, 3 cols on laptop */}
          {filteredOrders.length === 0 ? (
            <div className="p-12 text-center bg-white rounded-2xl border border-slate-200 shadow-xs">
              <Clock className="w-10 h-10 text-slate-300 mx-auto mb-2" />
              <h3 className="text-base font-bold text-slate-800">No orders in this state</h3>
              <p className="text-xs text-slate-400 mt-1">
                There are currently no orders with status "{orderFilter}".
              </p>
              {orderFilter !== 'ALL' && (
                <button
                  onClick={() => setOrderFilter('ALL')}
                  className="mt-4 px-3.5 py-1.5 bg-slate-900 text-white text-xs font-semibold rounded-lg cursor-pointer"
                >
                  View All Orders
                </button>
              )}
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3.5 sm:gap-4">
              {filteredOrders.map((ord) => {
                const statusTheme: Record<string, { bg: string; text: string; border: string }> = {
                  PLACED: { bg: 'bg-blue-50', text: 'text-blue-700', border: 'border-blue-200' },
                  PREPARING: { bg: 'bg-amber-50', text: 'text-amber-700', border: 'border-amber-200' },
                  READY: { bg: 'bg-purple-50', text: 'text-purple-700', border: 'border-purple-200' },
                  COMPLETED: { bg: 'bg-emerald-50', text: 'text-emerald-700', border: 'border-emerald-200' },
                  CANCELLED: { bg: 'bg-red-50', text: 'text-red-700', border: 'border-red-200' },
                };

                const theme = statusTheme[ord.order_status] || {
                  bg: 'bg-slate-50',
                  text: 'text-slate-700',
                  border: 'border-slate-200',
                };

                return (
                  <div
                    key={ord.order_id}
                    className="bg-white rounded-2xl border border-slate-200 p-4 shadow-xs flex flex-col justify-between space-y-3.5 transition-all hover:border-slate-300"
                  >
                    <div>
                      {/* Card Header: Table number badge, Order ID, and Status pill */}
                      <div className="flex items-start justify-between gap-2">
                        <div className="flex items-center gap-2">
                          <span className="px-2.5 py-1 bg-amber-600 text-white rounded-lg text-xs font-black tracking-wide shadow-xs">
                            TABLE {ord.table_number}
                          </span>
                          <div>
                            <h3 className="font-extrabold text-slate-900 text-sm sm:text-base leading-tight">
                              Order #{ord.order_id}
                            </h3>
                            <div className="text-[11px] text-slate-500 font-medium">
                              {ord.customer_name} · {ord.created_at}
                            </div>
                          </div>
                        </div>

                        <span
                          className={`text-[10px] font-black px-2.5 py-1 rounded-full uppercase border shrink-0 ${theme.bg} ${theme.text} ${theme.border}`}
                        >
                          {ord.order_status}
                        </span>
                      </div>

                      {/* Items list with quantity emphasis */}
                      <div className="mt-3.5 space-y-1.5 border-t border-b border-slate-100 py-3">
                        {ord.items.map((it) => (
                          <div key={it.order_item_id} className="flex justify-between items-center text-xs">
                            <span className="text-slate-800 font-medium truncate pr-2">
                              <span className="inline-block px-1.5 py-0.2 bg-amber-100 text-amber-900 font-black rounded mr-1.5">
                                {it.quantity}x
                              </span>
                              {it.item_name}
                            </span>
                            <span className="text-slate-600 font-semibold tabular-nums shrink-0">
                              {formatCurrency(it.unit_price * it.quantity)}
                            </span>
                          </div>
                        ))}
                      </div>

                      {/* Kitchen Special Notes */}
                      {ord.notes && (
                        <div className="mt-2.5 p-2.5 bg-amber-50/80 border border-amber-200/80 rounded-xl text-[11px] text-amber-900 font-medium">
                          <strong className="text-amber-800">Special Instructions:</strong> {ord.notes}
                        </div>
                      )}

                      {/* Total and Payment info */}
                      <div className="mt-3 flex justify-between items-center text-xs">
                        <span className="text-slate-500 font-medium flex items-center gap-1.5 flex-wrap">
                          <span>Method:</span>
                          <span className="font-bold text-slate-800">{ord.payment_method}</span>
                          <span
                            className={`px-1.5 py-0.5 rounded text-[10px] font-bold tracking-wide ${
                              ord.payment_status === 'PAID'
                                ? 'bg-emerald-100 text-emerald-800'
                                : 'bg-amber-100 text-amber-800'
                            }`}
                          >
                            {ord.payment_status}
                          </span>
                        </span>
                        <div className="text-right">
                          <span className="text-[10px] text-slate-400 block">Total Bill</span>
                          <span className="font-black text-slate-900 text-base tabular-nums">
                            {formatCurrency(ord.total_amount)}
                          </span>
                        </div>
                      </div>

                      {/* Cash / UPI Payment Confirmation by Authorized Staff */}
                      {ord.payment_status === 'PENDING' && onConfirmPayment && (
                        <div className="mt-2.5 p-2 bg-amber-50/90 border border-amber-200 rounded-xl flex items-center justify-between gap-2">
                          <div className="text-[11px] text-amber-900">
                            <span className="font-semibold block sm:inline">
                              {ord.payment_method === 'Cash' ? 'Cash Pending' : 'UPI Verification'}
                            </span>
                            <span className="text-amber-700 sm:ml-1 text-[10px]">
                              {ord.payment_method === 'Cash' ? '(Collect at counter)' : '(Verify payee receipt)'}
                            </span>
                          </div>
                          <button
                            type="button"
                            onClick={() => onConfirmPayment(ord.order_id)}
                            className="px-2.5 py-1.5 bg-emerald-600 hover:bg-emerald-700 text-white rounded-lg text-xs font-bold transition-colors cursor-pointer shadow-xs active:scale-95 shrink-0 flex items-center gap-1"
                            title="Confirm payment receipt from customer"
                          >
                            <CheckCircle2 className="w-3.5 h-3.5" />
                            <span>Confirm Paid</span>
                          </button>
                        </div>
                      )}
                    </div>

                    {/* Touch-Friendly Action Buttons (Min 44px tap targets for mobile & tablets) */}
                    <div className="pt-2 border-t border-slate-100 flex items-center gap-2">
                      {ord.order_status === 'PLACED' && (
                        <button
                          onClick={() => onUpdateOrderStatus(ord.order_id, 'PREPARING')}
                          className="flex-1 min-h-[44px] py-2.5 bg-amber-600 hover:bg-amber-700 text-white rounded-xl text-xs font-bold flex items-center justify-center gap-1.5 transition-colors cursor-pointer shadow-xs active:scale-98"
                        >
                          <ChefHat className="w-4 h-4" />
                          <span>Start Cooking</span>
                        </button>
                      )}

                      {ord.order_status === 'PREPARING' && (
                        <button
                          onClick={() => onUpdateOrderStatus(ord.order_id, 'READY')}
                          className="flex-1 min-h-[44px] py-2.5 bg-purple-600 hover:bg-purple-700 text-white rounded-xl text-xs font-bold flex items-center justify-center gap-1.5 transition-colors cursor-pointer shadow-xs active:scale-98"
                        >
                          <CheckCircle2 className="w-4 h-4" />
                          <span>Mark as Ready</span>
                        </button>
                      )}

                      {ord.order_status === 'READY' && (
                        <button
                          onClick={() => onUpdateOrderStatus(ord.order_id, 'COMPLETED')}
                          className="flex-1 min-h-[44px] py-2.5 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl text-xs font-bold flex items-center justify-center gap-1.5 transition-colors cursor-pointer shadow-xs active:scale-98"
                        >
                          <CheckCircle2 className="w-4 h-4" />
                          <span>Serve & Complete</span>
                        </button>
                      )}

                      {ord.order_status === 'COMPLETED' && (
                        <div className="flex-1 min-h-[40px] flex items-center justify-center text-emerald-700 bg-emerald-50 rounded-xl text-xs font-bold border border-emerald-200">
                          <Check className="w-3.5 h-3.5 mr-1" />
                          <span>Delivered to Table {ord.table_number}</span>
                        </div>
                      )}

                      {ord.order_status === 'CANCELLED' && (
                        <div className="flex-1 min-h-[40px] flex items-center justify-center text-red-700 bg-red-50 rounded-xl text-xs font-bold border border-red-200">
                          <XCircle className="w-3.5 h-3.5 mr-1" />
                          <span>Order Cancelled</span>
                        </div>
                      )}

                      {['PLACED', 'PREPARING'].includes(ord.order_status) && (
                        <button
                          onClick={() => {
                            const reason = prompt('Reason for cancelling this order:', 'Customer requested');
                            if (reason) onCancelOrder(ord.order_id, reason);
                          }}
                          className="min-h-[44px] min-w-[44px] flex items-center justify-center text-slate-400 hover:text-red-600 hover:bg-red-50 rounded-xl transition-colors cursor-pointer"
                          title="Cancel Order"
                        >
                          <XCircle className="w-4 h-4" />
                        </button>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      )}

      {/* ======================================================== */}
      {/* TAB 3: TABLES & QR CARDS (RESPONSIVE GRID) */}
      {/* ======================================================== */}
      {adminTab === 'tables' && (
        <div className="space-y-4">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
            <div className="flex items-center gap-1 p-1 bg-white border border-slate-200 rounded-xl shadow-xs">
              <button
                onClick={() => setSelectedFloor('Floor 1 (Inside)')}
                className={`flex-1 sm:flex-none px-3 py-1.5 text-xs font-bold rounded-lg transition-colors cursor-pointer ${
                  selectedFloor === 'Floor 1 (Inside)'
                    ? 'bg-amber-600 text-white shadow-xs'
                    : 'text-slate-600 hover:text-slate-900'
                }`}
              >
                Floor 1 (Inside)
              </button>
              <button
                onClick={() => setSelectedFloor('Floor 2 (Terrace)')}
                className={`flex-1 sm:flex-none px-3 py-1.5 text-xs font-bold rounded-lg transition-colors cursor-pointer ${
                  selectedFloor === 'Floor 2 (Terrace)'
                    ? 'bg-amber-600 text-white shadow-xs'
                    : 'text-slate-600 hover:text-slate-900'
                }`}
              >
                Floor 2 (Terrace)
              </button>
            </div>

            <div className="flex items-center gap-3 text-xs text-slate-500">
              <span className="flex items-center gap-1.5 font-medium">
                <span className="w-2.5 h-2.5 rounded-full bg-emerald-500" /> Vacant
              </span>
              <span className="flex items-center gap-1.5 font-medium">
                <span className="w-2.5 h-2.5 rounded-full bg-amber-600" /> Occupied
              </span>
            </div>
          </div>

          <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-3 sm:gap-4">
            {tables
              .filter((t) => t.floor === selectedFloor)
              .map((table) => {
                const isOccupied = table.status === 'OCCUPIED';
                const activeOrder = orders.find(
                  (o) => o.table_id === table.table_id && ['PLACED', 'PREPARING', 'READY'].includes(o.order_status)
                );

                return (
                  <div
                    key={table.table_id}
                    className={`p-3.5 sm:p-4 rounded-xl border flex flex-col justify-between transition-all ${
                      isOccupied
                        ? 'bg-amber-50/70 border-amber-300 shadow-xs'
                        : 'bg-white border-slate-200 hover:border-slate-300 shadow-xs'
                    }`}
                  >
                    <div>
                      <div className="flex items-center justify-between">
                        <span className="text-[10px] sm:text-xs font-bold text-slate-400">
                          {table.capacity} SEATS
                        </span>
                        <span
                          className={`text-[9px] sm:text-[10px] font-bold px-1.5 py-0.5 rounded ${
                            isOccupied
                              ? 'bg-amber-600 text-white'
                              : 'bg-emerald-100 text-emerald-800'
                          }`}
                        >
                          {table.status}
                        </span>
                      </div>

                      <div className="mt-2.5 text-center">
                        <span className="text-2xl sm:text-3xl font-black text-slate-900 tracking-tight">
                          T-{table.table_number}
                        </span>
                        <div className="text-[11px] text-slate-500 mt-0.5">
                          {isOccupied && activeOrder ? (
                            <span className="font-semibold text-amber-900 block truncate">
                              #{activeOrder.order_id} ({activeOrder.order_status})
                            </span>
                          ) : (
                            <span>Vacant</span>
                          )}
                        </div>
                      </div>
                    </div>

                    <div className="mt-3 pt-2.5 border-t border-slate-200/80 space-y-1.5">
                      <button
                        onClick={() => onOpenTableQr(table.table_number)}
                        className="w-full py-1.5 bg-white hover:bg-slate-100 text-slate-700 border border-slate-200 text-xs font-semibold rounded-lg flex items-center justify-center gap-1 transition-colors cursor-pointer"
                      >
                        <QrCode className="w-3.5 h-3.5" />
                        <span>View QR</span>
                      </button>

                      {isOccupied && (
                        <button
                          onClick={() => onReleaseTable(table.table_id)}
                          className="w-full py-1.5 bg-emerald-50 hover:bg-emerald-100 text-emerald-800 border border-emerald-200 text-xs font-semibold rounded-lg transition-colors cursor-pointer"
                        >
                          Clear Table
                        </button>
                      )}
                    </div>
                  </div>
                );
              })}
          </div>
        </div>
      )}

      {/* ======================================================== */}
      {/* TAB 4: SALES REPORTS */}
      {/* ======================================================== */}
      {adminTab === 'reports' && (
        <div className="space-y-4 sm:space-y-6">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4 sm:gap-5">
            <div className="bg-white p-4 sm:p-5 rounded-2xl border border-slate-200 shadow-xs">
              <h3 className="font-bold text-slate-900 text-sm mb-4">
                Popular Dishes by Order Volume
              </h3>
              <div className="space-y-3">
                {menuItems.slice(0, 5).map((dish, i) => (
                  <div key={dish.menu_item_id} className="space-y-1">
                    <div className="flex justify-between text-xs font-semibold">
                      <span className="text-slate-800 truncate pr-2">
                        #{i + 1} {dish.item_name}
                      </span>
                      <span className="text-amber-800 tabular-nums shrink-0">
                        {formatCurrency(dish.price * (5 - i))} · {5 - i} orders
                      </span>
                    </div>
                    <div className="w-full h-2 bg-slate-100 rounded-full overflow-hidden">
                      <div
                        className="h-full bg-amber-600 rounded-full"
                        style={{ width: `${(5 - i) * 20}%` }}
                      />
                    </div>
                  </div>
                ))}
              </div>
            </div>

            <div className="bg-white p-4 sm:p-5 rounded-2xl border border-slate-200 shadow-xs">
              <h3 className="font-bold text-slate-900 text-sm mb-4">
                Payment Channel Breakdown
              </h3>
              <div className="space-y-3">
                {[
                  { mode: 'UPI / Dynamic QR', count: 62, share: 62, color: 'bg-emerald-500' },
                  { mode: 'Credit / Debit Card', count: 26, share: 26, color: 'bg-blue-500' },
                  { mode: 'Cash at Counter', count: 12, share: 12, color: 'bg-amber-500' },
                ].map((pm) => (
                  <div key={pm.mode} className="space-y-1">
                    <div className="flex justify-between text-xs font-semibold">
                      <span className="text-slate-800">{pm.mode}</span>
                      <span className="text-slate-500 tabular-nums">{pm.share}%</span>
                    </div>
                    <div className="w-full h-2 bg-slate-100 rounded-full overflow-hidden">
                      <div
                        className={`h-full ${pm.color} rounded-full`}
                        style={{ width: `${pm.share}%` }}
                      />
                    </div>
                  </div>
                ))}
              </div>

              <div className="mt-6 pt-4 border-t border-slate-100 flex items-center justify-between text-xs">
                <span className="text-slate-500">Need paper summary?</span>
                <button
                  onClick={() => window.print()}
                  className="px-3 py-1.5 bg-slate-100 hover:bg-slate-200 text-slate-800 font-semibold rounded-lg flex items-center gap-1 cursor-pointer"
                >
                  <FileSpreadsheet className="w-3.5 h-3.5" />
                  <span>Export Report</span>
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* ======================================================== */}
      {/* ADD NEW MENU ITEM MODAL (MOBILE BOTTOM-SHEET / RESPONSIVE) */}
      {/* ======================================================== */}
      {isAddModalOpen && (
        <div className="fixed inset-0 z-50 overflow-y-auto bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-3 sm:p-4">
          <div className="relative w-full max-w-lg bg-white rounded-2xl shadow-2xl border border-slate-200 overflow-hidden my-auto max-h-[92vh] flex flex-col">
            {/* Modal Header */}
            <div className="px-5 py-3.5 border-b border-slate-200 flex items-center justify-between bg-slate-50 shrink-0">
              <div className="flex items-center gap-2">
                <Camera className="w-4 h-4 text-amber-600" />
                <h3 className="font-bold text-slate-900 text-sm">Add New Dish with Photo</h3>
              </div>
              <button
                onClick={handleCloseAddModal}
                className="text-slate-400 hover:text-slate-600 p-1 cursor-pointer"
              >
                <XCircle className="w-5 h-5" />
              </button>
            </div>

            {formError && (
              <div className="m-3 p-3 bg-red-50 border border-red-200 rounded-lg text-xs text-red-700 shrink-0">
                {formError}
              </div>
            )}

            {/* Modal Scrollable Body */}
            <form onSubmit={handleCreateMenuItem} className="p-4 sm:p-5 space-y-4 text-xs overflow-y-auto flex-1">
              {/* Dedicated Image Upload Field with Device Camera Integration */}
              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <label className="block font-bold text-slate-800">
                    Food Item Photo <span className="text-amber-600">*</span>
                  </label>
                  <span className="text-[10px] text-emerald-700 font-bold bg-emerald-50 px-2 py-0.5 rounded-full border border-emerald-200 flex items-center gap-1">
                    <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse" />
                    Syncs Live on Mobile & Laptop
                  </span>
                </div>

                {/* Hidden input configured specifically for mobile device camera */}
                <input
                  type="file"
                  accept="image/*"
                  capture="environment"
                  ref={fileInputCameraRef}
                  onChange={handleNativeFileSelect}
                  className="hidden"
                />

                {/* Hidden input for gallery / laptop file picker */}
                <input
                  type="file"
                  accept="image/*"
                  ref={fileInputGalleryRef}
                  onChange={handleNativeFileSelect}
                  className="hidden"
                />

                {/* 1. Live Camera Viewfinder if active (ideal for laptop webcam) */}
                {isCameraActive && (
                  <div className="relative rounded-2xl overflow-hidden bg-black aspect-video flex items-center justify-center border-2 border-amber-500 shadow-inner">
                    <video ref={videoRef} autoPlay playsInline muted className="w-full h-full object-cover" />

                    {/* Camera Control overlay */}
                    <div className="absolute top-2 right-2 flex gap-1.5">
                      <button
                        type="button"
                        onClick={toggleCameraFacing}
                        className="p-1.5 bg-black/60 hover:bg-black/80 text-white rounded-lg text-xs cursor-pointer flex items-center gap-1"
                        title="Flip Camera (Front/Rear)"
                      >
                        <SwitchCamera className="w-3.5 h-3.5" />
                      </button>
                    </div>

                    <div className="absolute bottom-3 left-0 right-0 flex items-center justify-center gap-3">
                      <button
                        type="button"
                        onClick={captureSnapshot}
                        disabled={isProcessingImage}
                        className="px-4 py-2 bg-amber-600 hover:bg-amber-700 text-white font-bold rounded-xl shadow-lg flex items-center gap-1.5 text-xs cursor-pointer"
                      >
                        <Camera className="w-4 h-4" />
                        <span>{isProcessingImage ? 'Optimizing...' : 'Snap Photo'}</span>
                      </button>
                      <button
                        type="button"
                        onClick={stopCamera}
                        className="px-3 py-2 bg-slate-800/90 hover:bg-slate-700 text-white rounded-xl text-xs font-semibold cursor-pointer"
                      >
                        Cancel
                      </button>
                    </div>
                  </div>
                )}

                {cameraError && (
                  <div className="p-3 bg-amber-50 border border-amber-200 rounded-xl text-xs text-amber-800 space-y-1">
                    <p className="font-semibold">{cameraError}</p>
                    <p className="text-[11px] text-amber-700">
                      Tip: Tap "Take Photo with Camera" below to use your device's native camera directly.
                    </p>
                  </div>
                )}

                {/* 2. Photo Preview if Image is Captured / Uploaded */}
                {!isCameraActive && newItemImage && (
                  <div className="relative rounded-2xl overflow-hidden border border-slate-200 bg-slate-900 flex items-center justify-center h-48 sm:h-56 shadow-sm">
                    <img
                      src={newItemImage}
                      alt="New dish preview"
                      className="w-full h-full object-cover"
                    />

                    {/* Top Status Tag */}
                    <div className="absolute top-2.5 left-2.5 bg-black/60 backdrop-blur-md px-2.5 py-1 rounded-lg text-white text-[11px] font-bold flex items-center gap-1.5 border border-white/20">
                      <Check className="w-3.5 h-3.5 text-emerald-400" />
                      <span>Photo Attached</span>
                    </div>

                    {/* Action buttons */}
                    <div className="absolute top-2.5 right-2.5 flex gap-1.5">
                      <button
                        type="button"
                        onClick={() => fileInputCameraRef.current?.click()}
                        className="px-2.5 py-1.5 bg-black/70 hover:bg-black/90 text-white rounded-lg text-xs font-semibold backdrop-blur-xs flex items-center gap-1 cursor-pointer transition-colors shadow-xs"
                        title="Retake photo using device camera"
                      >
                        <RotateCcw className="w-3 h-3" />
                        <span>Retake</span>
                      </button>
                      <button
                        type="button"
                        onClick={() => fileInputGalleryRef.current?.click()}
                        className="px-2.5 py-1.5 bg-black/70 hover:bg-black/90 text-white rounded-lg text-xs font-semibold backdrop-blur-xs flex items-center gap-1 cursor-pointer transition-colors shadow-xs"
                        title="Choose another image file"
                      >
                        <Upload className="w-3 h-3" />
                        <span className="hidden sm:inline">Change</span>
                      </button>
                      <button
                        type="button"
                        onClick={() => setNewItemImage(null)}
                        className="p-1.5 bg-red-600/90 hover:bg-red-700 text-white rounded-lg transition-colors cursor-pointer shadow-xs"
                        title="Remove photo"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  </div>
                )}

                {/* 3. Interactive Image Upload Field (Dropzone + Camera + File Chooser) */}
                {!isCameraActive && !newItemImage && (
                  <div
                    onDragOver={(e) => e.preventDefault()}
                    onDrop={(e) => {
                      e.preventDefault();
                      const file = e.dataTransfer.files?.[0];
                      if (file && file.type.startsWith('image/')) {
                        setIsProcessingImage(true);
                        compressImageToDataUrl(file, 640, 0.78)
                          .then((compressed) => setNewItemImage(compressed))
                          .catch((err) => console.log('Drop image error', err))
                          .finally(() => setIsProcessingImage(false));
                      }
                    }}
                    className="border-2 border-dashed border-amber-300 hover:border-amber-500 bg-amber-50/40 hover:bg-amber-50/70 rounded-2xl p-4 sm:p-5 transition-all text-center space-y-3"
                  >
                    <div className="w-12 h-12 rounded-2xl bg-amber-100 border border-amber-300/80 flex items-center justify-center text-amber-700 mx-auto shadow-xs">
                      <Camera className="w-6 h-6" />
                    </div>

                    <div>
                      <h4 className="font-extrabold text-slate-900 text-sm">
                        Capture or Select Dish Photo
                      </h4>
                      <p className="text-[11px] text-slate-500 mt-0.5 max-w-xs mx-auto">
                        Take a photo using your phone/laptop camera, or choose an existing food picture.
                      </p>
                    </div>

                    {/* Responsive Upload & Camera Actions */}
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 pt-1 max-w-md mx-auto">
                      {/* Primary Camera Button (Native Device Camera on mobile & laptop) */}
                      <button
                        type="button"
                        onClick={() => fileInputCameraRef.current?.click()}
                        className="min-h-[44px] py-2.5 px-3 bg-amber-600 hover:bg-amber-700 text-white rounded-xl font-bold text-xs flex items-center justify-center gap-2 shadow-xs transition-colors cursor-pointer active:scale-98"
                      >
                        <Camera className="w-4 h-4" />
                        <span>Take Photo with Camera</span>
                      </button>

                      {/* Browse File / Gallery Button */}
                      <button
                        type="button"
                        onClick={() => fileInputGalleryRef.current?.click()}
                        className="min-h-[44px] py-2.5 px-3 bg-white hover:bg-slate-100 border border-slate-300 text-slate-700 rounded-xl font-semibold text-xs flex items-center justify-center gap-2 shadow-xs transition-colors cursor-pointer active:scale-98"
                      >
                        <Upload className="w-4 h-4 text-slate-600" />
                        <span>Upload from Device</span>
                      </button>
                    </div>

                    {/* In-App Live Webcam Viewfinder Trigger (Ideal for laptops with webcam) */}
                    <div className="pt-1">
                      <button
                        type="button"
                        onClick={() => startCamera('environment')}
                        className="text-[11px] font-semibold text-amber-800 hover:text-amber-950 underline cursor-pointer inline-flex items-center gap-1"
                      >
                        <SwitchCamera className="w-3 h-3" />
                        <span>Or open live browser webcam viewfinder</span>
                      </button>
                    </div>
                  </div>
                )}

                {isProcessingImage && (
                  <div className="text-center text-xs text-amber-700 font-semibold py-1 animate-pulse flex items-center justify-center gap-1.5">
                    <span className="w-2 h-2 rounded-full bg-amber-500 animate-ping" />
                    <span>Compressing & optimizing photo for instant cross-device sync...</span>
                  </div>
                )}
              </div>

              <div>
                <label className="block font-semibold text-slate-700 mb-1">Dish Name *</label>
                <input
                  type="text"
                  value={newItemName}
                  onChange={(e) => setNewItemName(e.target.value)}
                  placeholder="e.g. Pistachio Matcha Latte"
                  className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-lg text-slate-900 focus:bg-white focus:outline-none focus:ring-2 focus:ring-amber-500"
                  required
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block font-semibold text-slate-700 mb-1">Category</label>
                  <select
                    value={newItemCategory}
                    onChange={(e) => setNewItemCategory(e.target.value as any)}
                    className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-lg text-slate-900 focus:bg-white focus:outline-none focus:ring-2 focus:ring-amber-500"
                  >
                    <option value="Coffee">Coffee</option>
                    <option value="Cold Brew">Cold Brew</option>
                    <option value="Breakfast">Breakfast</option>
                    <option value="Snacks">Snacks</option>
                    <option value="Mains">Mains</option>
                    <option value="Desserts">Desserts</option>
                  </select>
                </div>

                <div>
                  <label className="block font-semibold text-slate-700 mb-1">Price (₹) *</label>
                  <input
                    type="number"
                    min="0"
                    value={newItemPrice}
                    onChange={(e) => setNewItemPrice(Number(e.target.value))}
                    className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-lg text-slate-900 focus:bg-white focus:outline-none focus:ring-2 focus:ring-amber-500"
                    required
                  />
                </div>
              </div>

              <div>
                <label className="block font-semibold text-slate-700 mb-1">Description</label>
                <textarea
                  rows={2}
                  value={newItemDescription}
                  onChange={(e) => setNewItemDescription(e.target.value)}
                  placeholder="Fresh ingredients, taste notes, prep details..."
                  className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-lg text-slate-900 focus:bg-white focus:outline-none focus:ring-2 focus:ring-amber-500 resize-none"
                />
              </div>

              <div className="flex items-center gap-2 pt-1">
                <input
                  type="checkbox"
                  id="vegCheck"
                  checked={newItemIsVeg}
                  onChange={(e) => setNewItemIsVeg(e.target.checked)}
                  className="rounded text-amber-600 focus:ring-amber-500 w-4 h-4"
                />
                <label htmlFor="vegCheck" className="font-semibold text-slate-700 cursor-pointer">
                  Vegetarian Dish
                </label>
              </div>

              {/* Modal Footer Actions */}
              <div className="pt-3 border-t border-slate-200 flex justify-end gap-2 shrink-0">
                <button
                  type="button"
                  onClick={handleCloseAddModal}
                  className="px-3.5 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-lg font-medium cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-4 py-2 bg-amber-600 hover:bg-amber-700 text-white rounded-lg font-bold shadow-xs cursor-pointer flex items-center gap-1.5"
                >
                  <Check className="w-4 h-4" />
                  <span>Save Dish to Live Menu</span>
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Change Admin Password Modal */}
      {isChangePassModalOpen && (
        <div className="fixed inset-0 z-50 overflow-y-auto bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-3 sm:p-4">
          <div className="relative w-full max-w-md bg-white rounded-2xl shadow-2xl border border-slate-200 overflow-hidden my-auto">
            <div className="px-5 py-3.5 border-b border-slate-200 flex items-center justify-between bg-slate-50">
              <div className="flex items-center gap-2">
                <KeyRound className="w-4 h-4 text-amber-600" />
                <h3 className="font-bold text-slate-900 text-sm">Change Administrator Password</h3>
              </div>
              <button
                onClick={() => {
                  setIsChangePassModalOpen(false);
                  setChangePassError(null);
                  setChangePassSuccess(null);
                }}
                className="text-slate-400 hover:text-slate-600 p-1 cursor-pointer"
              >
                <XCircle className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleChangePassword} className="p-4 sm:p-5 space-y-4 text-xs">
              {changePassError && (
                <div className="p-3 bg-red-50 border border-red-200 rounded-xl text-red-700 flex items-start gap-2">
                  <AlertTriangle className="w-4 h-4 text-red-600 shrink-0 mt-0.5" />
                  <span>{changePassError}</span>
                </div>
              )}
              {changePassSuccess && (
                <div className="p-3 bg-emerald-50 border border-emerald-200 rounded-xl text-emerald-800 font-semibold flex items-center gap-2">
                  <CheckCircle className="w-4 h-4 text-emerald-600 shrink-0" />
                  <span>{changePassSuccess}</span>
                </div>
              )}

              <div>
                <label className="block font-semibold text-slate-700 mb-1">Current Password *</label>
                <input
                  type="password"
                  value={currentPassInput}
                  onChange={(e) => setCurrentPassInput(e.target.value)}
                  className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-lg text-slate-900 focus:bg-white focus:outline-none focus:ring-2 focus:ring-amber-500 text-sm"
                  placeholder="Enter current password"
                  required
                />
              </div>

              <div>
                <label className="block font-semibold text-slate-700 mb-1">New Secret Password *</label>
                <input
                  type="password"
                  value={newPassInput}
                  onChange={(e) => setNewPassInput(e.target.value)}
                  className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-lg text-slate-900 focus:bg-white focus:outline-none focus:ring-2 focus:ring-amber-500 text-sm"
                  placeholder="Minimum 4 characters"
                  required
                />
              </div>

              <div>
                <label className="block font-semibold text-slate-700 mb-1">Confirm New Password *</label>
                <input
                  type="password"
                  value={confirmPassInput}
                  onChange={(e) => setConfirmPassInput(e.target.value)}
                  className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-lg text-slate-900 focus:bg-white focus:outline-none focus:ring-2 focus:ring-amber-500 text-sm"
                  placeholder="Re-enter new password"
                  required
                />
              </div>

              <div className="p-3 bg-slate-50 border border-slate-200 rounded-xl text-[11px] text-slate-500 space-y-1">
                <p className="font-semibold text-slate-700">Security Note:</p>
                <p>
                  Setting a custom password prevents customers and unauthorized devices from opening this admin console or viewing kitchen orders.
                </p>
              </div>

              <div className="pt-3 border-t border-slate-200 flex justify-end gap-2">
                <button
                  type="button"
                  onClick={() => {
                    setIsChangePassModalOpen(false);
                    setChangePassError(null);
                  }}
                  className="px-3.5 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-lg font-medium cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-4 py-2 bg-amber-600 hover:bg-amber-700 text-white rounded-lg font-bold shadow-xs cursor-pointer flex items-center gap-1.5"
                >
                  <Check className="w-4 h-4" />
                  <span>Update Password</span>
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};
