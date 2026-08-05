import { useEffect, useState } from "react";
import axios from "axios";
import "./App.css";

const API = "http://127.0.0.1:8000";
const GOOGLE_CLIENT_ID = import.meta.env.VITE_GOOGLE_CLIENT_ID || "";
const roleOptions = [
  { value: "pricing manager", label: "Pricing Manager" },
  { value: "business analyst", label: "Business Analyst" },
  { value: "user", label: "User" },
];

function formatCurrency(value) {
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD",
    maximumFractionDigits: 0,
  }).format(value || 0);
}

export default function App() {
  const [token, setToken] = useState(localStorage.getItem("token") || "");
  const [mode, setMode] = useState("login");
  const [userName, setUserName] = useState("");
  const [userRole, setUserRole] = useState(
    localStorage.getItem("userRole") || "pricing manager",
  );

  const [auth, setAuth] = useState({
    name: "",
    email: "",
    password: "",
    confirmPassword: "",
    role: "pricing manager",
  });

  const [pricingForm, setPricingForm] = useState({
    product: 0,
    basePrice: 0,
    competitorPrice: 132,
    demandLevel: 78,
    inventoryLevel: 42,
  });

  const [products, setProducts] = useState([]);
  const [dashboard, setDashboard] = useState(null);
  const [salesInfo, setSalesInfo] = useState({ count: 0, sample: [] });
  const [googleReady, setGoogleReady] = useState(false);
  const [history, setHistory] = useState([]);
  const [alerts, setAlerts] = useState([]);
  const [recommendation, setRecommendation] = useState(null);
  const [productForm, setProductForm] = useState({
    id: null,
    name: "",
    category: "",
    current_price: "",
    cost_price: "",
    stock: "",
  });
  const [productMessage, setProductMessage] = useState({ type: "", text: "" });
  const [isSavingProduct, setIsSavingProduct] = useState(false);
  const [activeView, setActiveView] = useState("dashboard");
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false);
  const [activeAnchor, setActiveAnchor] = useState("");

  // Submit and Toast states
  const [isSubmittingAuth, setIsSubmittingAuth] = useState(false);
  const [isSubmittingPricing, setIsSubmittingPricing] = useState(false);
  const [toast, setToast] = useState({ show: false, message: "", type: "success" });

  const showToast = (message, type = "success") => {
    setToast({ show: true, message, type });
  };

  useEffect(() => {
    if (!toast.show) return;
    const timer = setTimeout(() => {
      setToast(prev => ({ ...prev, show: false }));
    }, 4000);
    return () => clearTimeout(timer);
  }, [toast.show]);

  // Product Catalog table states
  const [catalogSearch, setCatalogSearch] = useState("");
  const [catalogSortField, setCatalogSortField] = useState("name");
  const [catalogSortOrder, setCatalogSortOrder] = useState("asc");
  const [catalogPage, setCatalogPage] = useState(1);

  // Pricing table states
  const [pricingSearch, setPricingSearch] = useState("");
  const [pricingSortField, setPricingSortField] = useState("name");
  const [pricingSortOrder, setPricingSortOrder] = useState("asc");
  const [pricingPage, setPricingPage] = useState(1);

  // Sales table states
  const [salesSearch, setSalesSearch] = useState("");
  const [salesSortField, setSalesSortField] = useState("product_name");
  const [salesSortOrder, setSalesSortOrder] = useState("asc");
  const [salesPage, setSalesPage] = useState(1);

  const getFilteredCatalog = () => {
    let result = [...products];
    if (catalogSearch.trim()) {
      const q = catalogSearch.toLowerCase();
      result = result.filter(item => 
        (item.name || "").toLowerCase().includes(q) ||
        (item.category || "").toLowerCase().includes(q)
      );
    }
    result.sort((a, b) => {
      let aVal = a[catalogSortField];
      let bVal = b[catalogSortField];
      if (typeof aVal === 'string') {
        aVal = aVal.toLowerCase();
        bVal = bVal.toLowerCase();
      }
      if (aVal < bVal) return catalogSortOrder === "asc" ? -1 : 1;
      if (aVal > bVal) return catalogSortOrder === "asc" ? 1 : -1;
      return 0;
    });
    return result;
  };
  const catalogItemsPerPage = 5;
  const filteredCatalog = getFilteredCatalog();
  const totalCatalogPages = Math.ceil(filteredCatalog.length / catalogItemsPerPage) || 1;
  const paginatedCatalog = filteredCatalog.slice(
    (catalogPage - 1) * catalogItemsPerPage,
    catalogPage * catalogItemsPerPage
  );

  const getFilteredPricing = () => {
    let result = [...products];
    if (pricingSearch.trim()) {
      const q = pricingSearch.toLowerCase();
      result = result.filter(item => 
        (item.name || "").toLowerCase().includes(q)
      );
    }
    result.sort((a, b) => {
      let aVal = a[pricingSortField];
      let bVal = b[pricingSortField];
      if (pricingSortField === "suggested") {
        aVal = a.id === pricingForm.product && recommendation ? recommendation.suggestedPrice : a.current_price;
        bVal = b.id === pricingForm.product && recommendation ? recommendation.suggestedPrice : b.current_price;
      }
      if (typeof aVal === 'string') {
        aVal = aVal.toLowerCase();
        bVal = bVal.toLowerCase();
      }
      if (aVal < bVal) return pricingSortOrder === "asc" ? -1 : 1;
      if (aVal > bVal) return pricingSortOrder === "asc" ? 1 : -1;
      return 0;
    });
    return result;
  };
  const pricingItemsPerPage = 5;
  const filteredPricing = getFilteredPricing();
  const totalPricingPages = Math.ceil(filteredPricing.length / pricingItemsPerPage) || 1;
  const paginatedPricing = filteredPricing.slice(
    (pricingPage - 1) * pricingItemsPerPage,
    pricingPage * pricingItemsPerPage
  );

  const getFilteredSales = () => {
    let result = [...(salesInfo.sample || [])];
    if (salesSearch.trim()) {
      const q = salesSearch.toLowerCase();
      result = result.filter(item => 
        (item.product_name || "").toLowerCase().includes(q)
      );
    }
    result.sort((a, b) => {
      let aVal = a[salesSortField];
      let bVal = b[salesSortField];
      if (typeof aVal === 'string') {
        aVal = aVal.toLowerCase();
        bVal = bVal.toLowerCase();
      }
      if (aVal < bVal) return salesSortOrder === "asc" ? -1 : 1;
      if (aVal > bVal) return salesSortOrder === "asc" ? 1 : -1;
      return 0;
    });
    return result;
  };
  const salesItemsPerPage = 5;
  const filteredSales = getFilteredSales();
  const totalSalesPages = Math.ceil(filteredSales.length / salesItemsPerPage) || 1;
  const paginatedSales = filteredSales.slice(
    (salesPage - 1) * salesItemsPerPage,
    salesPage * salesItemsPerPage
  );

  function renderNavIcon(label) {
    const l = label.toLowerCase();
    if (l.includes("dashboard")) {
      return (
        <svg className="nav-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
          <path d="M3 9l9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z"/>
          <polyline points="9 22 9 12 15 12 15 22"/>
        </svg>
      );
    }
    if (l.includes("product")) {
      return (
        <svg className="nav-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
          <ellipse cx="12" cy="5" rx="9" ry="3"/>
          <path d="M3 5v14c0 1.66 4 3 9 3s9-1.34 9-3V5"/>
          <path d="M3 12c0 1.66 4 3 9 3s9-1.34 9-3"/>
        </svg>
      );
    }
    if (l.includes("optimizer") || l.includes("forecast") || l.includes("insights") || l.includes("outlook") || l.includes("planner")) {
      return (
        <svg className="nav-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
          <line x1="18" y1="20" x2="18" y2="10"/>
          <line x1="12" y1="20" x2="12" y2="4"/>
          <line x1="6" y1="20" x2="6" y2="14"/>
        </svg>
      );
    }
    if (l.includes("history") || l.includes("actions")) {
      return (
        <svg className="nav-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
          <circle cx="12" cy="12" r="10"/>
          <polyline points="12 6 12 12 16 14"/>
        </svg>
      );
    }
    if (l.includes("alert") || l.includes("quality") || l.includes("verification") || l.includes("pulse")) {
      return (
        <svg className="nav-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
          <path d="M18 8A6 6 0 0 0 6 8c0 7-3 9-3 9h18s-3-2-3-9"/>
          <path d="M13.73 21a2 2 0 0 1-3.46 0"/>
        </svg>
      );
    }
    return (
      <svg className="nav-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
        <circle cx="12" cy="12" r="10"/>
        <line x1="12" y1="8" x2="12" y2="16"/>
        <line x1="8" y1="12" x2="16" y2="12"/>
      </svg>
    );
  }

  function renderMetricCard(metric) {
    const label = metric.label.toLowerCase();
    let icon = null;
    let trend = null;
    let progress = 75;

    if (label.includes("revenue") || label.includes("pulse")) {
      icon = (
        <svg className="metric-icon blue" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
          <line x1="12" y1="1" x2="12" y2="23"/>
          <path d="M17 5H9.5a3.5 3.5 0 0 0 0 7h5a3.5 3.5 0 0 1 0 7H6"/>
        </svg>
      );
      trend = <span className="metric-trend positive">+14.2% vs last month</span>;
      progress = 84;
    } else if (label.includes("units") || label.includes("sold")) {
      icon = (
        <svg className="metric-icon green" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
          <path d="M6 2L3 6v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2V6l-3-4z"/>
          <line x1="3" y1="6" x2="21" y2="6"/>
          <path d="M16 10a4 4 0 0 1-8 0"/>
        </svg>
      );
      trend = <span className="metric-trend positive">+8.6% week-over-week</span>;
      progress = 68;
    } else if (label.includes("average") || label.includes("price") || label.includes("suggested") || label.includes("ai")) {
      icon = (
        <svg className="metric-icon purple" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
          <circle cx="12" cy="12" r="10"/>
          <polyline points="12 6 12 12 14 14"/>
        </svg>
      );
      trend = <span className="metric-trend neutral">Model Optimized</span>;
      progress = 92;
    } else if (label.includes("confidence")) {
      icon = (
        <svg className="metric-icon orange" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
          <path d="M22 11.08V12a10 10 0 1 1-5.93-9.14"/>
          <polyline points="22 4 12 14.01 9 11.01"/>
        </svg>
      );
      trend = <span className="metric-trend positive">High Reliability</span>;
      progress = 95;
    } else if (label.includes("alerts")) {
      icon = (
        <svg className="metric-icon red" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
          <path d="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z"/>
          <line x1="12" y1="9" x2="12" y2="13"/>
          <line x1="12" y1="17" x2="12.01" y2="17"/>
        </svg>
      );
      trend = metric.value > 0 ? <span className="metric-trend negative">Attention Required</span> : <span className="metric-trend positive">All Clear</span>;
      progress = metric.value > 0 ? 30 : 100;
    } else {
      icon = (
        <svg className="metric-icon blue" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
          <circle cx="12" cy="12" r="10"/>
          <line x1="12" y1="8" x2="12" y2="16"/>
          <line x1="8" y1="12" x2="16" y2="12"/>
        </svg>
      );
      trend = <span className="metric-trend neutral">Active Monitoring</span>;
      progress = 75;
    }

    return (
      <article key={metric.label} className="dashboard-card metric-card-enhanced">
        <div className="metric-card-header">
          <div className="metric-icon-wrap">{icon}</div>
          <span className="metric-card-label">{metric.label}</span>
        </div>
        <div className="metric-card-body">
          <strong className="metric-card-value">{metric.value}</strong>
          {trend}
        </div>
        <div className="metric-progress-wrapper">
          <div className="metric-progress-bar">
            <div className="metric-progress-fill" style={{ width: `${progress}%` }}></div>
          </div>
        </div>
        <p className="metric-card-desc">{metric.description}</p>
      </article>
    );
  }

  function renderSalesTable() {
    return (
      <div className="verification-box">
        <p>
          Loaded sales rows:
          <strong> {salesInfo.count || "0"}</strong>
        </p>
        <div className="table-search-bar">
          <input
            type="text"
            placeholder="Search sales..."
            value={salesSearch}
            onChange={(e) => {
              setSalesSearch(e.target.value);
              setSalesPage(1);
            }}
            className="table-search-input"
          />
        </div>
        <div className="table-wrap">
          <table className="sample-table">
            <thead>
              <tr>
                <th onClick={() => {
                  setSalesSortOrder(salesSortField === "product_name" && salesSortOrder === "asc" ? "desc" : "asc");
                  setSalesSortField("product_name");
                }} style={{ cursor: "pointer" }}>
                  Product {salesSortField === "product_name" ? (salesSortOrder === "asc" ? "▲" : "▼") : ""}
                </th>
                <th onClick={() => {
                  setSalesSortOrder(salesSortField === "price" && salesSortOrder === "asc" ? "desc" : "asc");
                  setSalesSortField("price");
                }} style={{ cursor: "pointer" }}>
                  Price {salesSortField === "price" ? (salesSortOrder === "asc" ? "▲" : "▼") : ""}
                </th>
                <th onClick={() => {
                  setSalesSortOrder(salesSortField === "quantity_sold" && salesSortOrder === "asc" ? "desc" : "asc");
                  setSalesSortField("quantity_sold");
                }} style={{ cursor: "pointer" }}>
                  Qty Sold {salesSortField === "quantity_sold" ? (salesSortOrder === "asc" ? "▲" : "▼") : ""}
                </th>
              </tr>
            </thead>
            <tbody>
              {paginatedSales.length > 0 ? (
                paginatedSales.map((row, index) => (
                  <tr key={index}>
                    <td>{row.product_name}</td>
                    <td>${row.price}</td>
                    <td>{row.quantity_sold || row.units_sold}</td>
                  </tr>
                ))
              ) : (
                <tr>
                  <td colSpan="3" style={{ textAlign: "center", padding: "20px" }}>
                    No sales sample loaded yet.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
        <div className="table-pagination">
          <button
            type="button"
            disabled={salesPage === 1}
            onClick={() => setSalesPage(prev => Math.max(prev - 1, 1))}
            className="pagination-btn"
          >
            Prev
          </button>
          <span className="pagination-info">Page {salesPage} of {totalSalesPages}</span>
          <button
            type="button"
            disabled={salesPage === totalSalesPages}
            onClick={() => setSalesPage(prev => Math.min(prev + 1, totalSalesPages))}
            className="pagination-btn"
          >
            Next
          </button>
        </div>
      </div>
    );
  }

  const headers = {
    Authorization: `Bearer ${token}`,
  };

  function getNormalizedRole(role) {
    const normalized = (role || "pricing manager").toLowerCase().trim();

    if (normalized.includes("manager")) return "pricing manager";
    if (normalized.includes("analyst")) return "business analyst";
    if (normalized.includes("user")) return "user";

    return "pricing manager";
  }

  function getRoleDisplayName(role) {
    switch (getNormalizedRole(role)) {
      case "business analyst":
        return "Business Analyst";
      case "user":
        return "User";
      default:
        return "Pricing Manager";
    }
  }

  function getRoleCopy(role) {
    switch (getNormalizedRole(role)) {
      case "business analyst":
        return {
          title: "Business Analysis Workspace",
          subtitle:
            "Review sales performance, demand signals, and forecast scenarios.",
          highlight: "Analyst focus",
        };
      case "user":
        return {
          title: "User View",
          subtitle: "Stay informed with the latest alerts and next actions.",
          highlight: "User focus",
        };
      default:
        return {
          title: "Pricing Manager Console",
          subtitle:
            "Lead price decisions, monitor demand, and protect margin health.",
          highlight: "Manager focus",
        };
    }
  }

  async function register() {
    setIsSubmittingAuth(true);
    try {
      await axios.post(`${API}/auth/register`, {
        ...auth,
        role: getNormalizedRole(auth.role),
      });
      showToast("Registration successful! Please login.", "success");
      setMode("login");
    } catch (error) {
      console.error("Registration failed", error);
      const detail = error.response?.data?.detail || "Registration failed. Try again.";
      showToast(detail, "error");
    } finally {
      setIsSubmittingAuth(false);
    }
  }

  async function login() {
    setIsSubmittingAuth(true);
    try {
      const response = await axios.post(`${API}/auth/login`, {
        email: auth.email,
        password: auth.password,
      });

      const normalizedRole = getNormalizedRole(response.data.role || auth.role);

      localStorage.setItem("token", response.data.access_token);
      localStorage.setItem("userName", auth.email.split("@")[0]);
      localStorage.setItem("userRole", normalizedRole);
      setUserName(auth.email.split("@")[0]);
      setUserRole(normalizedRole);
      setToken(response.data.access_token);
      showToast("Logged in successfully!", "success");
    } catch (error) {
      console.error("Login failed", error);
      const detail = error.response?.data?.detail || "Login failed. Check your credentials.";
      showToast(detail, "error");
    } finally {
      setIsSubmittingAuth(false);
    }
  }

  function decodeGoogleCredential(credential) {
    try {
      const payload = credential.split(".")[1];
      const normalized = payload.replace(/-/g, "+").replace(/_/g, "/");
      const padLength = (4 - (normalized.length % 4)) % 4;
      const padded = normalized + "=".repeat(padLength);
      const decoded = atob(padded);
      const jsonPayload = decodeURIComponent(
        decoded
          .split("")
          .map((char) => `%${`00${char.charCodeAt(0).toString(16)}`.slice(-2)}`)
          .join(""),
      );
      return JSON.parse(jsonPayload);
    } catch (error) {
      return null;
    }
  }

  // Handle credential response callback from Google
  async function handleGoogleCredentialResponse(response) {
    const role = getNormalizedRole(auth.role);
    const profile = decodeGoogleCredential(response.credential);

    try {
      const googleResponse = await axios.post(`${API}/auth/google`, {
        credential: response.credential,
        email: profile?.email || "",
        name: profile?.name || profile?.given_name || "",
        role,
      });

      const userName =
        profile?.name ||
        profile?.given_name ||
        googleResponse.data.user_name ||
        "Google User";
      const normalizedRole = getNormalizedRole(
        googleResponse.data.role || role,
      );

      localStorage.setItem("token", googleResponse.data.access_token);
      localStorage.setItem("userName", userName);
      localStorage.setItem("userRole", normalizedRole);
      setUserName(userName);
      setUserRole(normalizedRole);
      setToken(googleResponse.data.access_token);
      showToast("Logged in with Google successfully!", "success");
    } catch (error) {
      console.error("Google sign-in failed", error);
      showToast("Google sign-in failed. Please try again.", "error");
    }
  }

  async function loadData() {
    try {
      const productsResponse = await axios.get(`${API}/products`, { headers });
      const dashboardResponse = await axios.get(`${API}/dashboard`, {
        headers,
      });
      const salesCountResponse = await axios.get(`${API}/sales/count`);
      const salesSampleResponse = await axios.get(`${API}/sales/sample`);

      const fetchedProducts = productsResponse.data;
      setProducts(fetchedProducts);
      setDashboard(dashboardResponse.data);
      setSalesInfo({
        count: salesCountResponse.data.sales_count,
        sample: salesSampleResponse.data,
      });

      if (fetchedProducts.length > 0) {
        const firstProduct = fetchedProducts[0];
        setPricingForm((prev) => ({
          ...prev,
          product: firstProduct.id,
          basePrice: firstProduct.current_price,
        }));
      }

      const savedHistory = JSON.parse(
        localStorage.getItem("pricingHistory") || "[]",
      );
      setHistory(savedHistory);

      generateAlerts(fetchedProducts);
    } catch (error) {
      console.error("Error loading data:", error);
    }
  }

  function generateAlerts() {
    const sampleAlerts = [
      {
        id: 1,
        type: "warning",
        message: "Competitor lowered price on Smart Watch Pro by 5%",
      },
      {
        id: 2,
        type: "info",
        message:
          "Market demand for Wireless Headphones increased significantly",
      },
      {
        id: 3,
        type: "success",
        message: "Price adjustment on Action Camera improved margins by 8%",
      },
    ];
    setAlerts(sampleAlerts);
  }

  function calculateRecommendation() {
    const demand = pricingForm.demandLevel / 100;
    const inventory = pricingForm.inventoryLevel / 100;
    const basePrice = pricingForm.basePrice || 0;

    let suggestedPrice = basePrice;
    let revenueLift = 0;
    let confidence = 65;
    let reason = "Recommendations update based on demand and inventory.";

    if (demand > 0.7 && inventory < 0.5) {
      revenueLift = 18.7;
      suggestedPrice = basePrice * 1.15;
      confidence = 92;
      reason =
        "Demand is strong, so the model recommends a controlled increase.";
    } else if (demand > 0.5) {
      revenueLift = 8.3;
      suggestedPrice = basePrice * 1.08;
      confidence = 78;
      reason = "Moderate demand suggests a modest price increase.";
    } else if (demand < 0.4) {
      revenueLift = -7.2;
      suggestedPrice = basePrice * 0.92;
      confidence = 68;
      reason = "Lower demand suggests a price reduction to boost volume.";
    } else if (inventory > 0.7) {
      revenueLift = -5;
      suggestedPrice = basePrice * 0.95;
      confidence = 71;
      reason = "High inventory suggests a price reduction to accelerate sales.";
    } else {
      revenueLift = -2.5;
      suggestedPrice = basePrice * 0.97;
      confidence = 72;
      reason =
        "Stable demand with moderate inventory suggests a slight price adjustment.";
    }

    const projectedRevenue = basePrice
      ? (suggestedPrice * pricingForm.demandLevel * 100) / basePrice
      : 0;

    return {
      suggestedPrice: Math.round(suggestedPrice),
      revenueLift: revenueLift.toFixed(1),
      confidence: confidence,
      projectedRevenue: Math.round(projectedRevenue),
      reason,
    };
  }

  function updateRecommendation() {
    const newRecommendation = calculateRecommendation();
    setRecommendation(newRecommendation);

    const selectedProduct = products.find(
      (item) => item.id === pricingForm.product,
    );

    const newEntry = {
      id: Date.now(),
      product: selectedProduct
        ? selectedProduct.name
        : `Product ${pricingForm.product}`,
      basePrice: pricingForm.basePrice,
      suggestedPrice: newRecommendation.suggestedPrice,
      timestamp: new Date().toLocaleString(),
      demandLevel: pricingForm.demandLevel,
      inventoryLevel: pricingForm.inventoryLevel,
    };

    const updatedHistory = [newEntry, ...history.slice(0, 9)];
    setHistory(updatedHistory);
    localStorage.setItem("pricingHistory", JSON.stringify(updatedHistory));
  }

  async function handlePricingSubmit(e) {
    e.preventDefault();
    setIsSubmittingPricing(true);
    await new Promise((resolve) => setTimeout(resolve, 800));
    updateRecommendation();
    setIsSubmittingPricing(false);
    showToast("Price recommendation recalculated.", "success");
  }

  function clearHistory() {
    setHistory([]);
    localStorage.removeItem("pricingHistory");
  }

  function resetProductForm() {
    setProductForm({
      id: null,
      name: "",
      category: "",
      current_price: "",
      cost_price: "",
      stock: "",
    });
    setProductMessage({ type: "", text: "" });
  }

  function validateProductForm(form) {
    if (!form.name.trim()) {
      return "Product name is required.";
    }

    if (!form.category.trim()) {
      return "Category is required.";
    }

    const parsedPrice = Number(form.current_price);
    const parsedCost = Number(form.cost_price);
    const parsedStock = Number(form.stock);

    if (!Number.isFinite(parsedPrice) || parsedPrice < 0) {
      return "Current price must be a non-negative number.";
    }

    if (!Number.isFinite(parsedCost) || parsedCost < 0) {
      return "Cost price must be a non-negative number.";
    }

    if (!Number.isInteger(parsedStock) || parsedStock < 0) {
      return "Stock must be a whole number greater than or equal to zero.";
    }

    return "";
  }

  async function submitProductForm(event) {
    event.preventDefault();

    const validationMessage = validateProductForm(productForm);
    if (validationMessage) {
      showToast(validationMessage, "error");
      return;
    }

    setIsSavingProduct(true);

    const payload = {
      name: productForm.name.trim(),
      category: productForm.category.trim(),
      current_price: Number(productForm.current_price || 0),
      cost_price: Number(productForm.cost_price || 0),
      stock: Number(productForm.stock || 0),
    };

    try {
      if (productForm.id) {
        await axios.put(`${API}/products/${productForm.id}`, payload, {
          headers,
        });
        showToast("Product updated successfully.", "success");
      } else {
        await axios.post(`${API}/products`, payload, { headers });
        showToast("Product added successfully.", "success");
      }

      await loadData();
      resetProductForm();
    } catch (error) {
      console.error("Unable to save product", error);
      const detail = error.response?.data?.detail || "Unable to save product.";
      showToast(detail, "error");
    } finally {
      setIsSavingProduct(false);
    }
  }

  function editProduct(product) {
    setProductForm({
      id: product.id,
      name: product.name,
      category: product.category || "",
      current_price: product.current_price ?? "",
      cost_price: product.cost_price ?? "",
      stock: product.stock ?? "",
    });
  }

  async function deleteProduct(productId) {
    if (!window.confirm("Delete this product from the catalog?")) {
      return;
    }

    try {
      await axios.delete(`${API}/products/${productId}`, { headers });
      await loadData();
      if (productForm.id === productId) {
        resetProductForm();
      }
      showToast("Product deleted successfully.", "success");
    } catch (error) {
      console.error("Unable to delete product", error);
      const detail =
        error.response?.data?.detail || "Unable to delete product.";
      showToast(detail, "error");
    }
  }

  function logout() {
    localStorage.removeItem("token");
    localStorage.removeItem("userName");
    localStorage.removeItem("userRole");
    setToken("");
    setUserName("");
    setUserRole("pricing manager");
  }

  useEffect(() => {
    if (token) {
      const storedName = localStorage.getItem("userName") || "User";
      const storedRole = getNormalizedRole(
        localStorage.getItem("userRole") || "pricing manager",
      );
      setUserName(storedName);
      setUserRole(storedRole);
      loadData();
    }
  }, [token]);

  useEffect(() => {
    if (!productMessage.text) {
      return;
    }

    const timer = window.setTimeout(() => {
      setProductMessage({ type: "", text: "" });
    }, 3000);

    return () => window.clearTimeout(timer);
  }, [productMessage.text]);

  useEffect(() => {
    if (!GOOGLE_CLIENT_ID) {
      return;
    }

    const existingScript = document.getElementById("google-gsi");
    
    const initializeGoogle = () => {
      if (window.google?.accounts?.id) {
        window.google.accounts.id.initialize({
          client_id: GOOGLE_CLIENT_ID,
          callback: handleGoogleCredentialResponse,
        });

        const btnDiv = document.getElementById("google-signin-btn");
        if (btnDiv) {
          window.google.accounts.id.renderButton(btnDiv, {
            theme: "outline",
            size: "large",
            width: "320",
            type: "standard",
            text: "continue_with",
            shape: "rectangular",
          });
        }
        setGoogleReady(true);
      }
    };

    if (existingScript) {
      initializeGoogle();
      return;
    }

    const script = document.createElement("script");
    script.id = "google-gsi";
    script.src = "https://accounts.google.com/gsi/client";
    script.async = true;
    script.defer = true;
    script.onload = () => {
      initializeGoogle();
    };
    document.body.appendChild(script);
  }, [GOOGLE_CLIENT_ID, mode]);

  const roleCopy = getRoleCopy(userRole);

  const roleActions =
    getNormalizedRole(userRole) === "business analyst"
      ? [
          { label: "Demand Insights", href: "#analysisPanel" },
          { label: "Forecast View", href: "#forecastPanel" },
          { label: "Data Quality", href: "#salesPanel" },
          { label: "Products", type: "view", view: "products" },
        ]
      : getNormalizedRole(userRole) === "user"
        ? [
            { label: "Alerts", href: "#alertsPanel" },
            { label: "My Actions", href: "#historyList" },
            { label: "Products", href: "#productTable" },
          ]
        : [
            { label: "Optimizer", href: "#pricingForm" },
            { label: "Products", type: "view", view: "products" },
            { label: "History", href: "#historyList" },
          ];

  const roleMetrics =
    getNormalizedRole(userRole) === "business analyst"
      ? [
          {
            label: "Revenue Pulse",
            value: formatCurrency(dashboard?.total_revenue || 0),
            description: "Track portfolio health across all products.",
          },
          {
            label: "Units Sold",
            value: dashboard?.total_units_sold || 0,
            description: "A quick view of conversion intensity.",
          },
          {
            label: "Average Price",
            value: formatCurrency(dashboard?.average_product_price || 0),
            description: "Supports price sensitivity and forecast planning.",
          },
        ]
      : getNormalizedRole(userRole) === "user"
        ? [
            {
              label: "Open Alerts",
              value: alerts.length,
              description: "Stay aware of the latest changes.",
            },
            {
              label: "Saved Updates",
              value: history.length,
              description: "Your recent price actions are kept here.",
            },
            {
              label: "Products Tracked",
              value: products.length,
              description: "Monitor the key catalog items that matter to you.",
            },
          ]
        : [
            {
              label: "Recommended Revenue Lift",
              value: `${recommendation?.revenueLift || "18.7"}%`,
              description:
                "Based on demand, inventory, and competitor pressure.",
            },
            {
              label: "AI Suggested Price",
              value: `$${recommendation?.suggestedPrice || "129"}`,
              description: "Real-time pricing recommendation.",
            },
            {
              label: "Forecast Confidence",
              value: `${recommendation?.confidence || "92"}%`,
              description: "Confidence reflects current market conditions.",
            },
          ];

  const showProductsPage = activeView === "products";

  if (!token) {
    return (
      <main className="shell">
        <section
          className="brand-panel"
          aria-label="Revenue intelligence preview"
        >
          <nav className="topbar" aria-label="Product">
            <div className="logo-mark">R</div>
            <span>RevenueIQ</span>
          </nav>

          <div className="hero-copy">
            <p className="eyebrow">
              {mode === "login" ? "AI Pricing Console" : "Access Setup"}
            </p>
            <h1>
              {mode === "login"
                ? "Dynamic Pricing Optimization"
                : "Build your pricing command center"}
            </h1>
            <p>
              {mode === "login"
                ? "Monitor demand signals, competitor movement, inventory pressure, and recommended price actions from one revenue cockpit."
                : "Create a role-based workspace to review revenue signals, pricing recommendations, and forecast-ready market intelligence."}
            </p>
          </div>

          <div className="metrics-grid" aria-label="Revenue metrics">
            <article className="metric primary">
              <span>{mode === "login" ? "Revenue Lift" : "Role Access"}</span>
              <strong>{mode === "login" ? "18.7%" : "3 roles"}</strong>
              <small>
                {mode === "login"
                  ? "Projected this cycle"
                  : "Manager, analyst, and user"}
              </small>
            </article>
            <article className="metric">
              <span>{mode === "login" ? "Optimal Price" : "Role Views"}</span>
              <strong>{mode === "login" ? "$129" : "Tailored"}</strong>
              <small>
                {mode === "login"
                  ? "Recommended SKU avg."
                  : "Each workspace is tuned to the role"}
              </small>
            </article>
            <article className="metric">
              <span>{mode === "login" ? "Demand Index" : "Demo Accounts"}</span>
              <strong>{mode === "login" ? "84" : "3"}</strong>
              <small>
                {mode === "login"
                  ? "High confidence"
                  : "Ready for quick testing"}
              </small>
            </article>
          </div>

          <div className="chart-card" aria-label="Pricing trend chart">
            <div className="chart-head">
              <span>
                {mode === "login" ? "Price Elasticity" : "Role-Based Workspace"}
              </span>
              <strong>{mode === "login" ? "Live model" : "Active"}</strong>
            </div>
            <div className="bars">
              <span style={{ height: "42%" }}></span>
              <span style={{ height: "55%" }}></span>
              <span style={{ height: "48%" }}></span>
              <span style={{ height: "71%" }}></span>
              <span style={{ height: "64%" }}></span>
              <span style={{ height: "82%" }}></span>
              <span style={{ height: "76%" }}></span>
              <span style={{ height: "91%" }}></span>
            </div>
          </div>
        </section>

        <section className="login-panel" aria-label="Login form">
          <form
            className="login-card"
            onSubmit={(e) => {
              e.preventDefault();
              if (mode === "login") login();
              else register();
            }}
          >
            <div>
              <p className="eyebrow">
                {mode === "login" ? "Welcome back" : "Create account"}
              </p>
              <h2>
                {mode === "login"
                  ? "Sign in to your dashboard"
                  : "Register your workspace"}
              </h2>
            </div>

            {mode === "register" && (
              <div className="floating-label-group">
                <input
                  type="text"
                  id="auth-name"
                  placeholder=" "
                  value={auth.name}
                  onChange={(e) => setAuth({ ...auth, name: e.target.value })}
                  required
                />
                <label htmlFor="auth-name">Full name</label>
              </div>
            )}

            <div className="floating-label-group">
              <input
                type="email"
                id="auth-email"
                placeholder=" "
                value={auth.email}
                onChange={(e) => setAuth({ ...auth, email: e.target.value })}
                required
              />
              <label htmlFor="auth-email">Email</label>
            </div>

            <div className="floating-label-group">
              <input
                type="password"
                id="auth-password"
                placeholder=" "
                value={auth.password}
                onChange={(e) => setAuth({ ...auth, password: e.target.value })}
                minLength={mode === "register" ? 6 : undefined}
                required
              />
              <label htmlFor="auth-password">Password</label>
            </div>

            <div className="floating-label-group">
              <select
                id="auth-role"
                value={auth.role}
                onChange={(e) => setAuth({ ...auth, role: e.target.value })}
                required
              >
                {roleOptions.map((option) => (
                  <option key={option.value} value={option.value}>
                    {option.label}
                  </option>
                ))}
              </select>
              <label htmlFor="auth-role">Sign-in role</label>
            </div>

            {mode === "register" && (
              <div className="floating-label-group">
                <select
                  id="auth-role-reg"
                  value={auth.role}
                  onChange={(e) => setAuth({ ...auth, role: e.target.value })}
                  required
                >
                  {roleOptions.map((option) => (
                    <option key={option.value} value={option.value}>
                      {option.label}
                    </option>
                  ))}
                </select>
                <label htmlFor="auth-role-reg">Role</label>
              </div>
            )}

            {mode === "register" && (
              <div className="floating-label-group">
                <input
                  type="password"
                  id="auth-confirm"
                  placeholder=" "
                  minLength="6"
                  value={auth.confirmPassword}
                  onChange={(e) =>
                    setAuth({ ...auth, confirmPassword: e.target.value })
                  }
                  required
                />
                <label htmlFor="auth-confirm">Confirm password</label>
              </div>
            )}

            {mode === "login" && (
              <div className="row">
                <label className="remember">
                  <input type="checkbox" defaultChecked />
                  Remember me
                </label>
                <a href="#">Forgot password?</a>
              </div>
            )}

            <button type="submit" disabled={isSubmittingAuth}>
              {isSubmittingAuth ? (
                <span className="spinner-btn-content">
                  <span className="spinner-icon"></span>
                  Processing...
                </span>
              ) : (
                mode === "login" ? "Log in" : "Create account"
              )}
            </button>

            <div className="divider">
              <span>or</span>
            </div>

            {GOOGLE_CLIENT_ID ? (
              <div className="google-signin-container">
                <div id="google-signin-btn"></div>
              </div>
            ) : (
              <p className="signup" style={{ textAlign: "center", color: "#ef4444" }}>
                Google Client ID is missing. Configure it in .env.local
              </p>
            )}

            <p className="signup">
              {mode === "login" ? "New analyst?" : "Already registered?"}
              <button
                type="button"
                className="link-button"
                onClick={() => setMode(mode === "login" ? "register" : "login")}
              >
                {mode === "login" ? "Create account" : "Log in"}
              </button>
            </p>
          </form>
        </section>
      </main>
    );
  }

  return (
    <div className={`app-container ${sidebarCollapsed ? "sidebar-collapsed" : ""}`}>
      <aside className={`sidebar ${sidebarCollapsed ? "collapsed" : ""}`}>
        <div className="sidebar-brand-wrapper">
          <div className="sidebar-brand">
            <div className="logo-mark">R</div>
            <span className="brand-name">RevenueIQ</span>
          </div>
          <button 
            type="button" 
            className="sidebar-collapse-toggle" 
            onClick={() => setSidebarCollapsed(!sidebarCollapsed)}
            aria-label={sidebarCollapsed ? "Expand sidebar" : "Collapse sidebar"}
          >
            {sidebarCollapsed ? (
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><polyline points="9 18 15 12 9 6"/></svg>
            ) : (
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><polyline points="15 18 9 12 15 6"/></svg>
            )}
          </button>
        </div>

        <nav className="sidebar-nav">
          {/* Main views group */}
          <div className="nav-group">
            <span className="nav-group-title">Console</span>
            <button
              type="button"
              className={`nav-item ${activeView === "dashboard" && activeAnchor === "" ? "active" : ""}`}
              onClick={() => {
                setActiveView("dashboard");
                setActiveAnchor("");
              }}
            >
              {renderNavIcon("dashboard")}
              <span>Dashboard</span>
            </button>
            {roleActions.filter(action => action.type === "view").map((action) => (
              <button
                key={action.label}
                type="button"
                className={`nav-item ${activeView === action.view ? "active" : ""}`}
                onClick={() => {
                  setActiveView(action.view || "dashboard");
                  setActiveAnchor("");
                }}
              >
                {renderNavIcon(action.label)}
                <span>{action.label}</span>
              </button>
            ))}
          </div>

          {/* Tools & signals group */}
          {roleActions.filter(action => action.type !== "view").length > 0 && (
            <div className="nav-group workspace-group">
              <span className="nav-group-title">Workspace</span>
              {roleActions.filter(action => action.type !== "view").map((action) => (
                <a
                  key={action.label}
                  href={action.href}
                  className={`nav-item ${activeAnchor === action.href ? "active" : ""}`}
                  onClick={() => {
                    setActiveView("dashboard");
                    setActiveAnchor(action.href);
                  }}
                >
                  {renderNavIcon(action.label)}
                  <span>{action.label}</span>
                </a>
              ))}
            </div>
          )}
        </nav>

        <div className="sidebar-footer">
          <div className="user-profile">
            <div className="user-avatar">{userName.charAt(0).toUpperCase()}</div>
            <div className="user-info">
              <span className="user-name">{userName}</span>
              <span className="user-role">{getRoleDisplayName(userRole)}</span>
            </div>
          </div>
          <button 
            className="logout-button" 
            onClick={logout}
            title={sidebarCollapsed ? "Log out" : ""}
          >
            {sidebarCollapsed ? (
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" style={{width: "18px", height: "18px", stroke: "currentColor"}}>
                <path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4"/>
                <polyline points="16 17 21 12 16 7"/>
                <line x1="21" y1="12" x2="9" y2="12"/>
              </svg>
            ) : "Log out"}
          </button>
        </div>
      </aside>

      <main className="main-content">
        <header className="dashboard-header">
          <div>
            <h1>{roleCopy.title}</h1>
            <p id="welcomeUser">Welcome back, {userName}. {roleCopy.subtitle}</p>
          </div>
          <div className="header-actions">
            <button
              className="refresh-button"
              onClick={() => window.location.reload()}
            >
              Refresh Workspace
            </button>
          </div>
        </header>

        <section className="dashboard-grid" aria-label="Dashboard summary">
          {roleMetrics.map(renderMetricCard)}
        </section>

        {showProductsPage ? (
          <section
            className="product-shell"
            aria-label="Product management page"
          >
            <div className="panel-title panel-title-row">
              <div>
                <p className="eyebrow">Catalog</p>
                <h2>Product Catalog</h2>
              </div>
              <div className="inline-actions">
                <button
                  className="secondary-action compact-button"
                  type="button"
                  onClick={() => setActiveView("dashboard")}
                >
                  Back to dashboard
                </button>
              </div>
            </div>

            <section
              className="tool-panel product-manager-panel"
              aria-label="Product catalog manager"
            >
              <div className="panel-title panel-title-row">
                <div>
                  <p className="eyebrow">Catalog</p>
                  <h2>Manage Products</h2>
                </div>
                <button
                  className="secondary-action compact-button"
                  type="button"
                  onClick={resetProductForm}
                >
                  New product
                </button>
              </div>

              <form
                className="product-manager-grid"
                onSubmit={submitProductForm}
              >
                <div className="floating-label-group">
                  <input
                    type="text"
                    id="prod-name"
                    value={productForm.name}
                    onChange={(event) =>
                      setProductForm((prev) => ({
                        ...prev,
                        name: event.target.value,
                      }))
                    }
                    placeholder=" "
                    required
                  />
                  <label htmlFor="prod-name">Product name</label>
                </div>

                <div className="floating-label-group">
                  <input
                    type="text"
                    id="prod-category"
                    value={productForm.category}
                    onChange={(event) =>
                      setProductForm((prev) => ({
                        ...prev,
                        category: event.target.value,
                      }))
                    }
                    placeholder=" "
                    required
                  />
                  <label htmlFor="prod-category">Category</label>
                </div>

                <div className="floating-label-group">
                  <input
                    type="number"
                    id="prod-price"
                    min="0"
                    value={productForm.current_price}
                    onChange={(event) =>
                      setProductForm((prev) => ({
                        ...prev,
                        current_price: event.target.value,
                      }))
                    }
                    placeholder=" "
                  />
                  <label htmlFor="prod-price">Current price</label>
                </div>

                <div className="floating-label-group">
                  <input
                    type="number"
                    id="prod-cost"
                    min="0"
                    value={productForm.cost_price}
                    onChange={(event) =>
                      setProductForm((prev) => ({
                        ...prev,
                        cost_price: event.target.value,
                      }))
                    }
                    placeholder=" "
                  />
                  <label htmlFor="prod-cost">Cost price</label>
                </div>

                <div className="floating-label-group">
                  <input
                    type="number"
                    id="prod-stock"
                    min="0"
                    value={productForm.stock}
                    onChange={(event) =>
                      setProductForm((prev) => ({
                        ...prev,
                        stock: event.target.value,
                      }))
                    }
                    placeholder=" "
                  />
                  <label htmlFor="prod-stock">Stock</label>
                </div>

                <div className="button-row">
                  <button type="submit" disabled={isSavingProduct}>
                    {isSavingProduct ? (
                      <span className="spinner-btn-content">
                        <span className="spinner-icon"></span>
                        Saving...
                      </span>
                    ) : (
                      productForm.id ? "Update Product" : "Add Product"
                    )}
                  </button>
                  <button
                    className="secondary-action"
                    type="button"
                    onClick={resetProductForm}
                  >
                    Reset
                  </button>
                </div>
              </form>

              <div className="table-search-bar">
                <input
                  type="text"
                  placeholder="Search products..."
                  value={catalogSearch}
                  onChange={(e) => {
                    setCatalogSearch(e.target.value);
                    setCatalogPage(1);
                  }}
                  className="table-search-input"
                />
              </div>
              <div className="table-wrap">
                <table>
                  <thead>
                    <tr>
                      <th onClick={() => {
                        setCatalogSortOrder(catalogSortField === "name" && catalogSortOrder === "asc" ? "desc" : "asc");
                        setCatalogSortField("name");
                      }} style={{ cursor: "pointer" }} className="sortable-header">
                        Product {catalogSortField === "name" ? (catalogSortOrder === "asc" ? " ▲" : " ▼") : ""}
                      </th>
                      <th onClick={() => {
                        setCatalogSortOrder(catalogSortField === "category" && catalogSortOrder === "asc" ? "desc" : "asc");
                        setCatalogSortField("category");
                      }} style={{ cursor: "pointer" }} className="sortable-header">
                        Category {catalogSortField === "category" ? (catalogSortOrder === "asc" ? " ▲" : " ▼") : ""}
                      </th>
                      <th onClick={() => {
                        setCatalogSortOrder(catalogSortField === "current_price" && catalogSortOrder === "asc" ? "desc" : "asc");
                        setCatalogSortField("current_price");
                      }} style={{ cursor: "pointer" }} className="sortable-header">
                        Price {catalogSortField === "current_price" ? (catalogSortOrder === "asc" ? " ▲" : " ▼") : ""}
                      </th>
                      <th onClick={() => {
                        setCatalogSortOrder(catalogSortField === "stock" && catalogSortOrder === "asc" ? "desc" : "asc");
                        setCatalogSortField("stock");
                      }} style={{ cursor: "pointer" }} className="sortable-header">
                        Stock {catalogSortField === "stock" ? (catalogSortOrder === "asc" ? " ▲" : " ▼") : ""}
                      </th>
                      <th>Actions</th>
                    </tr>
                  </thead>
                  <tbody>
                    {paginatedCatalog.length > 0 ? (
                      paginatedCatalog.map((item) => (
                        <tr key={item.id}>
                          <td>{item.name}</td>
                          <td>{item.category}</td>
                          <td>${item.current_price}</td>
                          <td>{item.stock}</td>
                          <td>
                            <div className="inline-actions">
                              <button
                                type="button"
                                className="link-button compact-button"
                                onClick={() => editProduct(item)}
                              >
                                Edit
                              </button>
                              <button
                                type="button"
                                className="secondary-button compact-button"
                                onClick={() => deleteProduct(item.id)}
                              >
                                Delete
                              </button>
                            </div>
                          </td>
                        </tr>
                      ))
                    ) : (
                      <tr>
                        <td
                          colSpan="5"
                          style={{ textAlign: "center", padding: "20px" }}
                        >
                          No products available.
                        </td>
                      </tr>
                    )}
                  </tbody>
                </table>
              </div>
              <div className="table-pagination">
                <button
                  type="button"
                  disabled={catalogPage === 1}
                  onClick={() => setCatalogPage(prev => Math.max(prev - 1, 1))}
                  className="pagination-btn"
                >
                  Prev
                </button>
                <span className="pagination-info">Page {catalogPage} of {totalCatalogPages}</span>
                <button
                  type="button"
                  disabled={catalogPage === totalCatalogPages}
                  onClick={() => setCatalogPage(prev => Math.min(prev + 1, totalCatalogPages))}
                  className="pagination-btn"
                >
                  Next
                </button>
              </div>
            </section>
          </section>
        ) : getNormalizedRole(userRole) === "pricing manager" ? (
          <>
            <section className="workspace-grid" aria-label="Pricing tools">
              <form
                className="tool-panel"
                id="pricingForm"
                onSubmit={handlePricingSubmit}
              >
                <div className="panel-title">
                  <p className="eyebrow">Optimizer</p>
                  <h2>Price Recommendation</h2>
                </div>

                <div className="floating-label-group">
                  <select
                    id="productSelect"
                    value={pricingForm.product}
                    onChange={(e) => {
                      const selectedId = Number(e.target.value);
                      const selectedProduct = products.find(
                        (item) => item.id === selectedId,
                      );
                      setPricingForm({
                        ...pricingForm,
                        product: selectedId,
                        basePrice: selectedProduct
                          ? selectedProduct.current_price
                          : pricingForm.basePrice,
                      });
                      setRecommendation(null);
                    }}
                    required
                  >
                    {products.length > 0 ? (
                      products.map((item) => (
                        <option key={item.id} value={item.id}>
                          {item.name}
                        </option>
                      ))
                    ) : (
                      <option value="">Select a product</option>
                    )}
                  </select>
                  <label htmlFor="productSelect">Product</label>
                </div>

                <div className="floating-label-group">
                  <input
                    id="basePrice"
                    type="number"
                    min="1"
                    placeholder=" "
                    value={pricingForm.basePrice}
                    onChange={(e) =>
                      setPricingForm({
                        ...pricingForm,
                        basePrice: Number(e.target.value),
                      })
                    }
                    required
                  />
                  <label htmlFor="basePrice">Base price</label>
                </div>

                <div className="floating-label-group">
                  <input
                    id="competitorPrice"
                    type="number"
                    min="1"
                    placeholder=" "
                    value={pricingForm.competitorPrice}
                    onChange={(e) =>
                      setPricingForm({
                        ...pricingForm,
                        competitorPrice: Number(e.target.value),
                      })
                    }
                    required
                  />
                  <label htmlFor="competitorPrice">Competitor price</label>
                </div>

                <div className="slider-label-group">
                  <div className="slider-info">
                    <span>Demand level</span>
                    <output id="demandOutput">{pricingForm.demandLevel}%</output>
                  </div>
                  <input
                    id="demandLevel"
                    type="range"
                    min="1"
                    max="100"
                    value={pricingForm.demandLevel}
                    onChange={(e) =>
                      setPricingForm({
                        ...pricingForm,
                        demandLevel: Number(e.target.value),
                      })
                    }
                  />
                </div>

                <div className="slider-label-group">
                  <div className="slider-info">
                    <span>Inventory level</span>
                    <output id="inventoryOutput">{pricingForm.inventoryLevel}%</output>
                  </div>
                  <input
                    id="inventoryLevel"
                    type="range"
                    min="1"
                    max="100"
                    value={pricingForm.inventoryLevel}
                    onChange={(e) =>
                      setPricingForm({
                        ...pricingForm,
                        inventoryLevel: Number(e.target.value),
                      })
                    }
                  />
                </div>

                <div className="button-row">
                  <button type="submit" disabled={isSubmittingPricing}>
                    {isSubmittingPricing ? (
                      <span className="spinner-btn-content">
                        <span className="spinner-icon"></span>
                        Optimizing...
                      </span>
                    ) : "Update Recommendation"}
                  </button>
                  <button className="secondary-action" type="button">
                    Apply price
                  </button>
                </div>
              </form>

              <section className="tool-panel">
                <div className="panel-title">
                  <p className="eyebrow">Products</p>
                  <h2>Pricing Table</h2>
                </div>

              <div className="table-search-bar">
                <input
                  type="text"
                  placeholder="Search products..."
                  value={pricingSearch}
                  onChange={(e) => {
                    setPricingSearch(e.target.value);
                    setPricingPage(1);
                  }}
                  className="table-search-input"
                />
              </div>
              <div className="table-wrap">
                <table id="productTable">
                  <thead>
                    <tr>
                      <th onClick={() => {
                        setPricingSortOrder(pricingSortField === "name" && pricingSortOrder === "asc" ? "desc" : "asc");
                        setPricingSortField("name");
                      }} style={{ cursor: "pointer" }} className="sortable-header">
                        Product {pricingSortField === "name" ? (pricingSortOrder === "asc" ? " ▲" : " ▼") : ""}
                      </th>
                      <th onClick={() => {
                        setPricingSortOrder(pricingSortField === "current_price" && pricingSortOrder === "asc" ? "desc" : "asc");
                        setPricingSortField("current_price");
                      }} style={{ cursor: "pointer" }} className="sortable-header">
                        Current {pricingSortField === "current_price" ? (pricingSortOrder === "asc" ? " ▲" : " ▼") : ""}
                      </th>
                      <th onClick={() => {
                        setPricingSortOrder(pricingSortField === "suggested" && pricingSortOrder === "asc" ? "desc" : "asc");
                        setPricingSortField("suggested");
                      }} style={{ cursor: "pointer" }} className="sortable-header">
                        Suggested {pricingSortField === "suggested" ? (pricingSortOrder === "asc" ? " ▲" : " ▼") : ""}
                      </th>
                      <th>Status</th>
                    </tr>
                  </thead>
                  <tbody>
                    {paginatedPricing.length > 0 ? (
                      paginatedPricing.map((item) => (
                        <tr key={item.id}>
                          <td>{item.name}</td>
                          <td>${item.current_price}</td>
                          <td>
                            $
                            {item.id === pricingForm.product
                              ? recommendation
                                ? recommendation.suggestedPrice
                                : item.current_price
                              : item.current_price}
                          </td>
                          <td>
                            <span className="status-badge active-status">Active</span>
                          </td>
                        </tr>
                      ))
                    ) : (
                      <tr>
                        <td
                          colSpan="4"
                          style={{ textAlign: "center", padding: "20px" }}
                        >
                          No products added yet
                        </td>
                      </tr>
                    )}
                  </tbody>
                </table>
              </div>
              <div className="table-pagination">
                <button
                  type="button"
                  disabled={pricingPage === 1}
                  onClick={() => setPricingPage(prev => Math.max(prev - 1, 1))}
                  className="pagination-btn"
                >
                  Prev
                </button>
                <span className="pagination-info">Page {pricingPage} of {totalPricingPages}</span>
                <button
                  type="button"
                  disabled={pricingPage === totalPricingPages}
                  onClick={() => setPricingPage(prev => Math.min(prev + 1, totalPricingPages))}
                  className="pagination-btn"
                >
                  Next
                </button>
              </div>
              </section>
            </section>

            <section
              className="workspace-grid bottom-grid"
              aria-label="Revenue intelligence"
            >
              <section className="tool-panel" id="salesPanel">
                <div className="panel-title">
                  <p className="eyebrow">Dataset</p>
                  <h2>Sales Verification</h2>
                </div>
                {renderSalesTable()}
              </section>

              <section className="tool-panel" id="alertsPanel">
                <div className="panel-title">
                  <p className="eyebrow">Signals</p>
                  <h2>Market Alerts</h2>
                </div>
                <ul className="alert-list" id="alertList">
                  {alerts.map((alert) => (
                    <li key={alert.id} className={`alert-${alert.type}`}>
                      {alert.message}
                    </li>
                  ))}
                </ul>
              </section>
            </section>
          </>
        ) : getNormalizedRole(userRole) === "business analyst" ? (
          <>
            <section className="workspace-grid" aria-label="Analyst workspace">
              <section className="tool-panel" id="analysisPanel">
                <div className="panel-title">
                  <p className="eyebrow">Analysis</p>
                  <h2>Demand & Pricing Outlook</h2>
                </div>
                <ul className="insight-list">
                  <li>
                    Demand signals suggest strong momentum for premium audio
                    products.
                  </li>
                  <li>
                    Inventory pressure is easing for select accessories and
                    peripherals.
                  </li>
                  <li>
                    Revenue concentration is still strongest in mobile and
                    display categories.
                  </li>
                </ul>
              </section>

              <section className="tool-panel" id="forecastPanel">
                <div className="panel-title">
                  <p className="eyebrow">Forecast</p>
                  <h2>Scenario Planner</h2>
                </div>
                <div className="projection-box">
                  <span>Scenario projection</span>
                  <strong>
                    {formatCurrency(dashboard?.total_revenue || 0)}
                  </strong>
                  <p>
                    Current portfolio revenue suggests a stable and explainable
                    baseline for the next pricing cycle.
                  </p>
                </div>
              </section>
            </section>

            <section
              className="workspace-grid bottom-grid"
              aria-label="Analyst data quality"
            >
              <section className="tool-panel" id="salesPanel">
                <div className="panel-title">
                  <p className="eyebrow">Data Quality</p>
                  <h2>Sales Verification</h2>
                </div>
                {renderSalesTable()}
              </section>

              <section className="tool-panel">
                <div className="panel-title">
                  <p className="eyebrow">Signals</p>
                  <h2>Market Alerts</h2>
                </div>
                <ul className="alert-list">
                  {alerts.map((alert) => (
                    <li key={alert.id} className={`alert-${alert.type}`}>
                      {alert.message}
                    </li>
                  ))}
                </ul>
              </section>
            </section>
          </>
        ) : (
          <>
            <section className="workspace-grid" aria-label="User workspace">
              <section className="tool-panel">
                <div className="panel-title">
                  <p className="eyebrow">View</p>
                  <h2>What Changed</h2>
                </div>
                <ul className="insight-list">
                  <li>
                    Recent alerts are grouped so you can quickly understand the
                    latest actions.
                  </li>
                  <li>
                    Saved updates are available for your review without changing
                    the pricing engine.
                  </li>
                  <li>
                    Products tracked for you are surfaced so you can follow what
                    matters most.
                  </li>
                </ul>
              </section>

              <section className="tool-panel">
                <div className="panel-title">
                  <p className="eyebrow">Next Step</p>
                  <h2>Recommended Action</h2>
                </div>
                <div className="projection-box">
                  <span>Suggested focus</span>
                  <strong>Review your alerts</strong>
                  <p>
                    Use the latest market and pricing updates to stay aligned
                    with the current plan.
                  </p>
                </div>
              </section>
            </section>

            <section
              className="tool-panel history-panel"
              aria-label="User history"
            >
              <div className="panel-title panel-title-row">
                <div>
                  <p className="eyebrow">Updates</p>
                  <h2>Saved History</h2>
                </div>
              </div>
              <div className="history-list" id="historyList">
                {history.length > 0 ? (
                  <ul>
                    {history.map((item) => (
                      <li key={item.id}>
                        <div className="history-item">
                          <strong>{item.product}</strong>
                          <span className="history-price">
                            ${item.basePrice} → ${item.suggestedPrice}
                          </span>
                          <span className="history-time">{item.timestamp}</span>
                        </div>
                      </li>
                    ))}
                  </ul>
                ) : (
                  <p className="empty-state">No recommendations saved yet.</p>
                )}
              </div>
            </section>
          </>
        )}
      </main>

      {toast.show && (
        <div className={`toast-notification ${toast.type}`}>
          <span className="toast-icon">
            {toast.type === "success" ? (
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" style={{width: "16px", height: "16px"}}><polyline points="20 6 9 17 4 12"/></svg>
            ) : (
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" style={{width: "16px", height: "16px"}}><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>
            )}
          </span>
          <span className="toast-message">{toast.message}</span>
        </div>
      )}
    </div>
  );
}
