import { useEffect, useState } from "react";
import axios from "axios";
import "./App.css";

const API = "http://127.0.0.1:8000";
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
  const [history, setHistory] = useState([]);
  const [alerts, setAlerts] = useState([]);
  const [recommendation, setRecommendation] = useState(null);

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
    await axios.post(`${API}/auth/register`, {
      ...auth,
      role: getNormalizedRole(auth.role),
    });
    alert("Registration successful. Please login.");
    setMode("login");
  }

  async function login() {
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

  function clearHistory() {
    setHistory([]);
    localStorage.removeItem("pricingHistory");
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

  const roleCopy = getRoleCopy(userRole);

  const roleActions =
    getNormalizedRole(userRole) === "business analyst"
      ? [
          { label: "Demand Insights", href: "#analysisPanel" },
          { label: "Forecast View", href: "#forecastPanel" },
          { label: "Data Quality", href: "#salesPanel" },
        ]
      : getNormalizedRole(userRole) === "user"
        ? [
            { label: "Alerts", href: "#alertsPanel" },
            { label: "My Actions", href: "#historyList" },
            { label: "Products", href: "#productTable" },
          ]
        : [
            { label: "Optimizer", href: "#pricingForm" },
            { label: "Products", href: "#productTable" },
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
              <label>
                Full name
                <input
                  type="text"
                  placeholder="Mrunal Patel"
                  value={auth.name}
                  onChange={(e) => setAuth({ ...auth, name: e.target.value })}
                  required
                />
              </label>
            )}

            <label>
              Email
              <input
                type="email"
                placeholder="admin@revenueiq.com"
                value={auth.email}
                onChange={(e) => setAuth({ ...auth, email: e.target.value })}
                required
              />
            </label>

            <label>
              Password
              <input
                type="password"
                placeholder={
                  mode === "login" ? "Enter password" : "Minimum 6 characters"
                }
                value={auth.password}
                onChange={(e) => setAuth({ ...auth, password: e.target.value })}
                minLength={mode === "register" ? 6 : undefined}
                required
              />
            </label>

            {mode === "register" && (
              <label>
                Role
                <select
                  value={auth.role}
                  onChange={(e) => setAuth({ ...auth, role: e.target.value })}
                >
                  {roleOptions.map((option) => (
                    <option key={option.value} value={option.value}>
                      {option.label}
                    </option>
                  ))}
                </select>
              </label>
            )}

            {mode === "register" && (
              <label>
                Confirm password
                <input
                  type="password"
                  placeholder="Re-enter password"
                  minLength="6"
                  value={auth.confirmPassword}
                  onChange={(e) =>
                    setAuth({ ...auth, confirmPassword: e.target.value })
                  }
                  required
                />
              </label>
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

            <p className="message" id="loginMessage" role="status"></p>

            <button type="submit">
              {mode === "login" ? "Log in" : "Create account"}
            </button>

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
    <main className="dashboard-body">
      <div className="dashboard">
        <header className="dashboard-header">
          <div>
            <p className="eyebrow">RevenueIQ</p>
            <h1>{roleCopy.title}</h1>
            <p id="welcomeUser">
              Welcome back, {userName}. {roleCopy.subtitle}
            </p>
          </div>
          <div className="header-actions">
            <span className="role-pill">{getRoleDisplayName(userRole)}</span>
            <button className="secondary-button" onClick={logout}>
              Log out
            </button>
          </div>
        </header>

        <section className="quick-actions" aria-label="Quick actions">
          {roleActions.map((action) => (
            <a key={action.label} href={action.href}>
              {action.label}
            </a>
          ))}
          <button
            className="ghost-button"
            onClick={() => window.location.reload()}
          >
            Refresh workspace
          </button>
        </section>

        <section className="dashboard-grid" aria-label="Dashboard summary">
          {roleMetrics.map((metric) => (
            <article key={metric.label} className="dashboard-card">
              <span>{metric.label}</span>
              <strong>{metric.value}</strong>
              <p>{metric.description}</p>
            </article>
          ))}
        </section>

        {getNormalizedRole(userRole) === "pricing manager" ? (
          <>
            <section className="workspace-grid" aria-label="Pricing tools">
              <form
                className="tool-panel"
                id="pricingForm"
                onSubmit={(e) => {
                  e.preventDefault();
                  updateRecommendation();
                }}
              >
                <div className="panel-title">
                  <p className="eyebrow">Optimizer</p>
                  <h2>Price Recommendation</h2>
                </div>

                <label>
                  Product
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
                </label>

                <label>
                  Base price
                  <input
                    id="basePrice"
                    type="number"
                    min="1"
                    value={pricingForm.basePrice}
                    onChange={(e) =>
                      setPricingForm({
                        ...pricingForm,
                        basePrice: Number(e.target.value),
                      })
                    }
                  />
                </label>

                <label>
                  Competitor price
                  <input
                    id="competitorPrice"
                    type="number"
                    min="1"
                    value={pricingForm.competitorPrice}
                    onChange={(e) =>
                      setPricingForm({
                        ...pricingForm,
                        competitorPrice: Number(e.target.value),
                      })
                    }
                  />
                </label>

                <label>
                  Demand level
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
                  <output id="demandOutput">{pricingForm.demandLevel}</output>
                </label>

                <label>
                  Inventory level
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
                  <output id="inventoryOutput">
                    {pricingForm.inventoryLevel}
                  </output>
                </label>

                <div className="button-row">
                  <button type="submit">Update Recommendation</button>
                  <button className="secondary-action" type="button">
                    Apply price
                  </button>
                </div>
                <p className="message" id="dashboardMessage" role="status"></p>
              </form>

              <section className="tool-panel">
                <div className="panel-title">
                  <p className="eyebrow">Products</p>
                  <h2>Pricing Table</h2>
                </div>

                <div className="table-wrap">
                  <table id="productTable">
                    <thead>
                      <tr>
                        <th>Product</th>
                        <th>Current</th>
                        <th>Suggested</th>
                        <th>Status</th>
                      </tr>
                    </thead>
                    <tbody>
                      {products.length > 0 ? (
                        products.map((item) => (
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
                              <span className="status-badge">Active</span>
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
                <div className="verification-box">
                  <p>
                    Loaded sales rows:
                    <strong> {salesInfo.count || "0"}</strong>
                  </p>
                  <div className="sample-table-wrap">
                    <table className="sample-table">
                      <thead>
                        <tr>
                          <th>Product</th>
                          <th>Price</th>
                          <th>Qty Sold</th>
                        </tr>
                      </thead>
                      <tbody>
                        {salesInfo.sample.length > 0 ? (
                          salesInfo.sample.map((row, index) => (
                            <tr key={index}>
                              <td>{row.product_name}</td>
                              <td>${row.price}</td>
                              <td>{row.quantity_sold || row.units_sold}</td>
                            </tr>
                          ))
                        ) : (
                          <tr>
                            <td colSpan="3" style={{ textAlign: "center" }}>
                              No sales sample loaded yet.
                            </td>
                          </tr>
                        )}
                      </tbody>
                    </table>
                  </div>
                </div>
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
                <div className="verification-box">
                  <p>
                    Loaded sales rows:
                    <strong> {salesInfo.count || "0"}</strong>
                  </p>
                  <div className="sample-table-wrap">
                    <table className="sample-table">
                      <thead>
                        <tr>
                          <th>Product</th>
                          <th>Price</th>
                          <th>Qty Sold</th>
                        </tr>
                      </thead>
                      <tbody>
                        {salesInfo.sample.length > 0 ? (
                          salesInfo.sample.map((row, index) => (
                            <tr key={index}>
                              <td>{row.product_name}</td>
                              <td>${row.price}</td>
                              <td>{row.quantity_sold || row.units_sold}</td>
                            </tr>
                          ))
                        ) : (
                          <tr>
                            <td colSpan="3" style={{ textAlign: "center" }}>
                              No sales sample loaded yet.
                            </td>
                          </tr>
                        )}
                      </tbody>
                    </table>
                  </div>
                </div>
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
      </div>
    </main>
  );
}
