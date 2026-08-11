import React, { useState, useEffect } from "react";
import axios from "axios";

const API = "http://127.0.0.1:8000";

export default function AIRecommendation({ products, salesInfo }) {
  const [selectedProductId, setSelectedProductId] = useState("");
  const [competitorPrice, setCompetitorPrice] = useState("");
  const [recommendation, setRecommendation] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  const formatCurrency = (val) => {
    return new Intl.NumberFormat("en-IN", {
      style: "currency",
      currency: "INR",
      maximumFractionDigits: 2,
    }).format(val || 0);
  };

  const getActiveConstraint = (report) => {
    if (!report) return null;
    const recPrice = report.recommended_price || 0;
    const minPrice = report.minimum_allowed_price || 0;
    const compPrice = report.competitor_price;
    const supply = report.days_of_supply || 0;

    if (Math.abs(recPrice - minPrice) < 0.1) {
      return {
        factor: "Cost / Minimum Margin Floor",
        message: `Determined by Cost / Minimum Margin Floor: Price is constrained to the absolute floor of ${formatCurrency(minPrice)} to protect profitability, as cost is ${formatCurrency(report.cost_price)} and the minimum margin limit is 5% (Cost ₹${report.cost_price.toFixed(2)} * 1.05 = ₹${minPrice.toFixed(2)}).`
      };
    }

    if (supply > 30 && compPrice !== null && compPrice !== undefined && compPrice > 0) {
      const upperLimit = Math.max(compPrice, minPrice);
      if (Math.abs(recPrice - upperLimit) < 0.1) {
        return {
          factor: "Competitor Price Cap",
          message: `Determined by Competitor Price Cap: High inventory supply (${supply.toFixed(1)} days) triggered competitive capping to match competitor price of ${formatCurrency(compPrice)}.`
        };
      }
    }

    return {
      factor: "Price Elasticity / Demand Engine",
      message: `Determined by AI Profit Maximization: Optimized to ${formatCurrency(recPrice)} based on price elasticity (${report.price_elasticity}) and demand forecast to maximize expected revenue.`
    };
  };

  const getFactorsList = (report) => {
    if (!report) return [];
    
    const recPrice = report.recommended_price || 0;
    const minPrice = report.minimum_allowed_price || 0;
    const compPrice = report.competitor_price;
    const currPrice = report.current_price || 0;
    const supply = report.days_of_supply || 0;
    const elasticity = report.price_elasticity || 0;
    const trend = report.demand_trend || "";
    const seasonality = report.seasonality || "";
    const confidence = report.forecast_confidence || 0;
    const stock = report.current_stock || 0;
    const cost = report.cost_price || 0;
    const histSales = report.historical_sales || 0;
    const dailyVel = report.daily_sales_velocity || 0;
    const horizon = report.forecast_period || "90-day horizon";

    const list = [];

    // 1. Forecast Demand
    let demandDir = "Neutral";
    let demandStr = "Weak";
    let demandReason = "Stable demand keeps baseline pricing target neutral.";
    if (trend === "Seasonal" || trend === "Increasing") {
      demandDir = "Upward";
      demandStr = "Moderate";
      demandReason = `Forecast demand of ${report.expected_demand.toFixed(1)} units over the forecast period supports price premium options.`;
    } else if (trend === "Decreasing") {
      demandDir = "Downward";
      demandStr = "Strong";
      demandReason = `Soft expected demand of ${report.expected_demand.toFixed(1)} units over the forecast period expects lower price adjustments.`;
    }
    list.push({
      name: "Forecast Demand",
      value: `${report.expected_demand.toFixed(1)} units (${horizon})`,
      direction: demandDir,
      strength: demandStr,
      reason: demandReason
    });

    // 2. Historical Daily Sales Velocity
    list.push({
      name: "Historical Daily Sales Velocity",
      value: `${dailyVel.toFixed(4)} units/day`,
      direction: "Neutral",
      strength: "Weak",
      reason: `Formula: Historical Sales / 30 Days = ${histSales.toFixed(0)} / 30 = ${dailyVel.toFixed(4)} units/day velocity basis.`
    });

    // 3. Competitor Price
    let compDir = "Neutral";
    let compStr = "Weak";
    let compReason = "No active competitor price pressure detected.";
    if (compPrice !== null && compPrice !== undefined && compPrice > 0) {
      if (compPrice > currPrice) {
        compDir = "Upward";
        compStr = "Moderate";
        compReason = `Competitor price (${formatCurrency(compPrice)}) is higher than current price (${formatCurrency(currPrice)}), allowing upward headroom.`;
      } else if (compPrice < currPrice) {
        compDir = "Downward";
        compStr = supply > 30 ? "Strong" : "Moderate";
        compReason = supply > 30 
          ? `Competitor price (${formatCurrency(compPrice)}) imposes a hard cap because inventory days of supply (${supply.toFixed(1)}) is high (> 30 days).`
          : `Competitor price (${formatCurrency(compPrice)}) creates downward pressure on margins.`;
      } else {
        compDir = "Neutral";
        compStr = "Weak";
        compReason = "Competitor price matches current pricing level.";
      }
    }
    list.push({
      name: "Competitor Price",
      value: compPrice ? formatCurrency(compPrice) : "—",
      direction: compDir,
      strength: compStr,
      reason: compReason
    });

    // 4. Cost / Minimum Margin
    const isCostActive = Math.abs(recPrice - minPrice) < 0.1;
    list.push({
      name: "Cost / Minimum Margin",
      value: `${formatCurrency(cost)} (Min Floor: ${formatCurrency(minPrice)})`,
      direction: "Hard Price Floor",
      strength: isCostActive ? "Strong" : "Weak",
      reason: isCostActive 
        ? `Active constraint: Price is set to the floor of ${formatCurrency(minPrice)} to prevent margins from falling below cost + 5%.`
        : `Inactive constraint: Recommended price stays safely above the minimum margin floor of ${formatCurrency(minPrice)}.`
    });

    // 5. Inventory / Days of Supply
    let invDir = "Neutral";
    let invStr = "Weak";
    let invReason = "Healthy supply levels keep inventory contribution neutral.";
    if (supply < 10) {
      invDir = "Upward";
      invStr = "Strong";
      invReason = `Formula: Stock / Daily Sales Velocity = ${stock} / ${dailyVel.toFixed(4)} = ${supply.toFixed(1)} Days supply. Low supply (< 10 days) supports higher margins.`;
    } else if (supply > 30) {
      invDir = "Downward";
      invStr = "Strong";
      invReason = `Formula: Stock / Daily Sales Velocity = ${stock} / ${dailyVel.toFixed(4)} = ${supply.toFixed(1)} Days supply. Excess supply (> 30 days) forces downward price adjustment.`;
    }
    list.push({
      name: "Inventory / Days of Supply",
      value: `${stock} units (${supply.toFixed(1)} Days supply)`,
      direction: invDir,
      strength: invStr,
      reason: invReason
    });

    // 6. Price Elasticity
    let elDir = "Neutral";
    let elStr = "Weak";
    let elReason = "Unit elastic demand keeps revenue effect balanced.";
    if (elasticity < -1.0) {
      elDir = "Downward";
      elStr = elasticity < -1.5 ? "Strong" : "Moderate";
      elReason = `Price elasticity of ${elasticity} indicates high price sensitivity; lowering price will boost volume and revenue.`;
    } else if (elasticity > -1.0) {
      elDir = "Upward";
      elStr = elasticity > -0.5 ? "Strong" : "Moderate";
      elReason = `Price elasticity of ${elasticity} indicates low price sensitivity; allows price increases without significant volume drops.`;
    }
    list.push({
      name: "Price Elasticity",
      value: String(elasticity),
      direction: elDir,
      strength: elStr,
      reason: elReason
    });

    // 7. Demand Trend
    let trendDir = "Neutral";
    let trendStr = "Weak";
    let trendReason = "Steady trend keeps price projections stable.";
    if (trend === "Increasing") {
      trendDir = "Upward";
      trendStr = "Strong";
      trendReason = "Sustained upward sales momentum supports higher price targets.";
    } else if (trend === "Seasonal") {
      trendDir = "Upward";
      trendStr = "Moderate";
      trendReason = "Expected seasonal cycle pattern supports pricing optimization.";
    } else if (trend === "Decreasing") {
      trendDir = "Downward";
      trendStr = "Strong";
      trendReason = "Slowing sales momentum suggests downward pricing is required.";
    }
    list.push({
      name: "Demand Trend",
      value: trend,
      direction: trendDir,
      strength: trendStr,
      reason: trendReason
    });

    // 8. Seasonality
    let seasDir = "Neutral";
    let seasStr = "Weak";
    let seasReason = "Normal seasonal variations have neutral impact on target price.";
    if (seasonality === "Strong" || seasonality === "High") {
      seasDir = "Upward";
      seasStr = "Moderate";
      seasReason = "High seasonal demand period supports higher price targets.";
    }
    list.push({
      name: "Seasonality",
      value: seasonality,
      direction: seasDir,
      strength: seasStr,
      reason: seasReason
    });

    // 9. Forecast Confidence
    let confStr = "Weak";
    if (confidence > 85) {
      confStr = "Strong";
    } else if (confidence > 70) {
      confStr = "Moderate";
    }
    list.push({
      name: "Forecast Confidence",
      value: confidence ? `${confidence.toFixed(2)}%` : "N/A",
      direction: "Neutral",
      strength: confStr,
      reason: confidence > 85 
        ? "High forecast accuracy increases recommendation reliability." 
        : "Confidence level suggests stable prediction reliability."
    });

    return list;
  };

  const selectedProduct = products.find((p) => String(p.id) === String(selectedProductId));

  useEffect(() => {
    if (products && products.length > 0 && !selectedProductId) {
      const firstProduct = products[0];
      const firstId = String(firstProduct.id);
      setSelectedProductId(firstId);
      setCompetitorPrice((firstProduct.current_price * 1.05).toFixed(2));
    }
  }, [products]);

  const handleProductChange = (e) => {
    const id = e.target.value;
    setSelectedProductId(id);
    const product = products.find((p) => String(p.id) === String(id));
    if (product) {
      setCompetitorPrice((product.current_price * 1.05).toFixed(2));
    }
    setRecommendation(null);
    setError("");
  };

  const handleGenerate = async (e) => {
    if (e) e.preventDefault();
    if (!selectedProduct) return;

    setLoading(true);
    setError("");

    let salesCount = 100;
    let revenueSum = 100 * (selectedProduct.current_price || 1.0);
    if (salesInfo && salesInfo.sample) {
      const productSales = salesInfo.sample.filter(
        (s) => s.product_name === selectedProduct.name || String(s.product_id) === String(selectedProduct.id)
      );
      const units = productSales.reduce((acc, s) => acc + (s.quantity_sold || s.units_sold || 0), 0);
      const rev = productSales.reduce((acc, s) => acc + (s.revenue || 0), 0);
      if (units > 0) salesCount = units;
      if (rev > 0) revenueSum = rev;
    }

    try {
      const response = await axios.get(`${API}/api/ai/recommend-price`, {
        params: {
          stockcode: String(selectedProduct.id),
          current_price: selectedProduct.current_price,
          current_inventory: selectedProduct.stock || 50,
          historical_sales: salesCount,
          historical_revenue: revenueSum,
          quantity: 10,
          revenue: revenueSum,
          competitor_price: competitorPrice ? Number(competitorPrice) : null
        },
      });

      if (response.data && response.data.status === "success") {
        setRecommendation(response.data.recommendation);
      } else {
        setError("Invalid response format received from pricing service.");
      }
    } catch (err) {
      console.error("Error loading price recommendation:", err);
      setError(
        err.response?.data?.detail || "Failed to load price recommendations from AI module."
      );
    } finally {
      setLoading(false);
    }
  };

  const getRecommendationBadge = (recType) => {
    const label = recType || "Maintain Price";
    if (label.includes("Increase")) {
      return (
        <span className="inline-flex items-center px-4 py-1.5 rounded-full text-sm font-semibold bg-emerald-100 dark:bg-emerald-950/40 text-emerald-700 dark:text-emerald-400 border border-emerald-200 dark:border-emerald-900/50">
          <span className="w-2 h-2 mr-2 rounded-full bg-emerald-500 animate-pulse"></span>
          {label}
        </span>
      );
    }
    if (label.includes("Decrease")) {
      return (
        <span className="inline-flex items-center px-4 py-1.5 rounded-full text-sm font-semibold bg-rose-100 dark:bg-rose-950/40 text-rose-700 dark:text-rose-400 border border-rose-200 dark:border-rose-900/50">
          <span className="w-2 h-2 mr-2 rounded-full bg-rose-500 animate-pulse"></span>
          {label}
        </span>
      );
    }
    return (
      <span className="inline-flex items-center px-4 py-1.5 rounded-full text-sm font-semibold bg-amber-100 dark:bg-amber-950/40 text-amber-700 dark:text-amber-400 border border-amber-200 dark:border-amber-900/50">
        <span className="w-2 h-2 mr-2 rounded-full bg-amber-500"></span>
        {label}
      </span>
    );
  };

  return (
    <div className="text-left w-full max-w-6xl mx-auto px-4 py-6 space-y-6">
      <header className="mb-6">
        <p className="text-sm font-semibold tracking-wider text-violet-600 dark:text-violet-400 uppercase">AI Dynamic Pricing</p>
        <h1 className="text-3xl font-extrabold text-slate-900 dark:text-white mt-1">Pricing Recommendation Workspace</h1>
        <p className="text-slate-500 dark:text-slate-400 mt-2">Professional pricing intelligence tool powered by Prophet demand forecasts and profit maximization models.</p>
      </header>

      {error && (
        <div className="p-4 bg-rose-50 dark:bg-rose-950/20 border border-rose-200 dark:border-rose-900/50 rounded-2xl text-rose-600 dark:text-rose-400 text-left">
          <h4 className="font-bold">Error</h4>
          <p className="text-sm mt-1">{error}</p>
        </div>
      )}

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Left Column: Product Selector & Parameters */}
        <div className="lg:col-span-1 space-y-6">
          <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl p-6 shadow-sm space-y-5">
            <h3 className="text-lg font-bold text-slate-900 dark:text-white">Product Parameters</h3>

            <div>
              <label htmlFor="prod-select" className="block text-xs font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400 mb-2">Product selector</label>
              <select
                id="prod-select"
                value={selectedProductId}
                onChange={handleProductChange}
                className="w-full bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl px-4 py-3 text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-violet-500 font-medium text-sm cursor-pointer"
              >
                {products && products.length > 0 ? (
                  products.map((item) => (
                    <option key={item.id} value={item.id}>
                      {item.name}
                    </option>
                  ))
                ) : (
                  <option value="">No products available</option>
                )}
              </select>
            </div>

            <div>
              <label htmlFor="competitor-price" className="block text-xs font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400 mb-2">Competitor Price (₹)</label>
              <input
                id="competitor-price"
                type="number"
                step="0.01"
                min="0"
                value={competitorPrice}
                onChange={(e) => setCompetitorPrice(e.target.value)}
                className="w-full bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl px-4 py-3 text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-violet-500 font-medium text-sm"
                required
              />
            </div>

            <button
              onClick={handleGenerate}
              disabled={loading || !selectedProductId}
              className="w-full flex items-center justify-center gap-2 py-3.5 bg-violet-600 hover:bg-violet-700 disabled:bg-slate-200 dark:disabled:bg-slate-800 disabled:text-slate-400 dark:disabled:text-slate-600 text-white rounded-xl font-bold transition shadow-md shadow-violet-500/10 cursor-pointer"
            >
              {loading ? (
                <>
                  <div className="w-5 h-5 border-2 border-white border-t-transparent rounded-full animate-spin"></div>
                  <span>Calculating...</span>
                </>
              ) : (
                <span>Generate AI Price Recommendation</span>
              )}
            </button>
          </div>
        </div>

        {/* Right Column: Key Business Metrics & Outputs */}
        <div className="lg:col-span-2 space-y-6">
          <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl p-6 shadow-sm space-y-6">
            {!recommendation ? (
              <>
                <h3 className="text-lg font-bold text-slate-900 dark:text-white">Business Metrics</h3>
                <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
                  <div className="bg-slate-50 dark:bg-slate-800/40 p-4 rounded-xl border border-slate-100 dark:border-slate-800/50">
                    <span className="text-xs font-semibold text-slate-500 dark:text-slate-400 block">Current Price</span>
                    <span className="text-lg font-bold text-slate-800 dark:text-slate-200 mt-1 block">
                      {selectedProduct ? formatCurrency(selectedProduct.current_price) : "₹0.00"}
                    </span>
                  </div>

                  <div className="bg-slate-50 dark:bg-slate-800/40 p-4 rounded-xl border border-slate-100 dark:border-slate-800/50">
                    <span className="text-xs font-semibold text-slate-500 dark:text-slate-400 block">Competitor Price</span>
                    <span className="text-lg font-bold text-slate-800 dark:text-slate-200 mt-1 block">
                      {competitorPrice ? formatCurrency(Number(competitorPrice)) : "—"}
                    </span>
                  </div>

                  <div className="bg-slate-50 dark:bg-slate-800/40 p-4 rounded-xl border border-slate-100 dark:border-slate-800/50">
                    <span className="text-xs font-semibold text-slate-500 dark:text-slate-400 block">Cost Price</span>
                    <span className="text-lg font-bold text-slate-800 dark:text-slate-200 mt-1 block">
                      {selectedProduct ? formatCurrency(selectedProduct.cost_price) : "₹0.00"}
                    </span>
                  </div>

                  <div className="bg-slate-50 dark:bg-slate-800/40 p-4 rounded-xl border border-slate-100 dark:border-slate-800/50">
                    <span className="text-xs font-semibold text-slate-500 dark:text-slate-400 block">Current Stock</span>
                    <span className="text-lg font-bold text-slate-800 dark:text-slate-200 mt-1 block">
                      {selectedProduct ? `${selectedProduct.stock} units` : "—"}
                    </span>
                  </div>
                </div>
                <div className="text-center py-8 text-slate-550 dark:text-slate-400 text-sm">
                  Click "Generate AI Price Recommendation" to run the optimization model.
                </div>
              </>
            ) : (
              <>
                <div className="bg-violet-50/50 dark:bg-violet-950/20 p-6 rounded-2xl border border-violet-100 dark:border-violet-900/30 text-center space-y-2">
                  <span className="text-sm font-bold text-violet-600 dark:text-violet-400 uppercase tracking-wider block">AI Recommended Price</span>
                  <span className="text-4xl font-extrabold text-violet-700 dark:text-violet-300 block">
                    {formatCurrency(recommendation.pricing_analysis_report.recommended_price)}
                  </span>
                </div>

                <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
                  <div className="bg-slate-50 dark:bg-slate-800/40 p-4 rounded-xl border border-slate-100 dark:border-slate-800/50">
                    <span className="text-xs font-semibold text-slate-500 dark:text-slate-400 block">Current Price</span>
                    <span className="text-lg font-bold text-slate-800 dark:text-slate-200 mt-1 block">
                      {formatCurrency(recommendation.pricing_analysis_report.current_price)}
                    </span>
                  </div>

                  <div className="bg-slate-50 dark:bg-slate-800/40 p-4 rounded-xl border border-slate-100 dark:border-slate-800/50">
                    <span className="text-xs font-semibold text-slate-500 dark:text-slate-400 block">Competitor Price</span>
                    <span className="text-lg font-bold text-slate-800 dark:text-slate-200 mt-1 block">
                      {recommendation.pricing_analysis_report.competitor_price ? formatCurrency(recommendation.pricing_analysis_report.competitor_price) : "—"}
                    </span>
                  </div>

                  <div className="bg-slate-50 dark:bg-slate-800/40 p-4 rounded-xl border border-slate-100 dark:border-slate-800/50">
                    <span className="text-xs font-semibold text-slate-500 dark:text-slate-400 block">Expected Demand</span>
                    <span className="text-lg font-bold text-slate-800 dark:text-slate-200 mt-1 block">
                      {recommendation.pricing_analysis_report.expected_demand.toFixed(1)} units
                    </span>
                  </div>

                  <div className="bg-slate-50 dark:bg-slate-800/40 p-4 rounded-xl border border-slate-100 dark:border-slate-800/50">
                    <span className="text-xs font-semibold text-slate-500 dark:text-slate-400 block">Expected Revenue</span>
                    <span className="text-lg font-bold text-slate-800 dark:text-slate-200 mt-1 block">
                      {formatCurrency(recommendation.pricing_analysis_report.expected_revenue)}
                    </span>
                  </div>

                  <div className="bg-slate-50 dark:bg-slate-800/40 p-4 rounded-xl border border-slate-100 dark:border-slate-800/50">
                    <span className="text-xs font-semibold text-slate-500 dark:text-slate-400 block">Expected Profit</span>
                    <span className="text-lg font-bold text-slate-800 dark:text-slate-200 mt-1 block">
                      {formatCurrency(recommendation.pricing_analysis_report.expected_profit)}
                    </span>
                  </div>

                  <div className="bg-slate-50 dark:bg-slate-800/40 p-4 rounded-xl border border-slate-100 dark:border-slate-800/50">
                    <span className="text-xs font-semibold text-slate-500 dark:text-slate-400 block">Forecast Confidence</span>
                    <span className="text-lg font-bold text-slate-800 dark:text-slate-200 mt-1 block">
                      {recommendation.pricing_analysis_report.forecast_confidence ? `${recommendation.pricing_analysis_report.forecast_confidence.toFixed(2)}%` : "N/A"}
                    </span>
                  </div>
                </div>
              </>
            )}
          </div>
        </div>
      </div>

      {/* Why did AI recommend this price? Card */}
      {recommendation && (
        <section className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl p-6 text-left text-slate-900 dark:text-white shadow-sm relative overflow-hidden space-y-6">
          <div className="absolute top-0 right-0 w-60 h-60 bg-violet-600/10 rounded-full filter blur-3xl -translate-y-1/2 translate-x-1/2"></div>
          
          <div className="flex items-center gap-2 relative">
            <div className="p-2.5 bg-violet-600/20 rounded-xl text-violet-600 dark:text-violet-400 border border-violet-500/20">
              <svg className="w-5 h-5" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" d="M9.813 15.904L9 21l-1.81-2.904L4.5 18l.813-5.096L3 9h5.187L9 4l.813 5H15l-1.813 3.904L14 18l-4.188-2.096z" />
              </svg>
            </div>
            <h3 className="font-bold text-lg tracking-tight">Why did AI recommend this price?</h3>
          </div>

          <div className="relative text-sm text-slate-700 dark:text-slate-200 leading-relaxed italic bg-slate-50 dark:bg-slate-950/60 border border-slate-200 dark:border-slate-800 p-5 rounded-xl">
            {recommendation.pricing_analysis_report.summary}
          </div>

          {/* Ultimate Determining Constraint Callout */}
          {(() => {
            const constraint = getActiveConstraint(recommendation.pricing_analysis_report);
            return constraint ? (
              <div className="p-4 rounded-xl border border-violet-200 dark:border-violet-800 bg-violet-50/50 dark:bg-violet-950/20 text-slate-800 dark:text-slate-200">
                <div className="flex items-center gap-2 mb-1.5">
                  <span className="flex h-2.5 w-2.5 relative">
                    <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-violet-400 opacity-75"></span>
                    <span className="relative inline-flex rounded-full h-2.5 w-2.5 bg-violet-500"></span>
                  </span>
                  <span className="text-xs font-semibold uppercase tracking-wider text-violet-600 dark:text-violet-400">Ultimate Determining Constraint</span>
                </div>
                <p className="text-sm font-semibold">{constraint.message}</p>
              </div>
            ) : null;
          })()}

          <div className="relative border border-slate-200 dark:border-slate-800 rounded-xl overflow-hidden bg-slate-50/20 dark:bg-slate-950/40">
            <table className="w-full text-sm text-left text-slate-700 dark:text-slate-300">
              <thead className="text-xs uppercase bg-slate-50 dark:bg-slate-950 text-slate-500 dark:text-slate-400 border-b border-slate-200 dark:border-slate-800">
                <tr>
                  <th className="px-6 py-3.5 font-semibold">Factor</th>
                  <th className="px-6 py-3.5 font-semibold">Actual Value</th>
                  <th className="px-6 py-3.5 font-semibold">Effect Direction</th>
                  <th className="px-6 py-3.5 font-semibold">Effect Strength</th>
                  <th className="px-6 py-3.5 font-semibold">Reasoning</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 dark:divide-slate-800/60 text-slate-700 dark:text-slate-300 bg-white dark:bg-slate-900">
                {getFactorsList(recommendation.pricing_analysis_report).map((factor, idx) => (
                  <tr key={idx}>
                    <td className="px-6 py-3.5 font-medium">{factor.name}</td>
                    <td className="px-6 py-3.5">{factor.value}</td>
                    <td className="px-6 py-3.5">
                      {factor.direction === "Upward" && (
                        <span className="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-semibold bg-emerald-100 dark:bg-emerald-950/40 text-emerald-700 dark:text-emerald-400 border border-emerald-200 dark:border-emerald-900/50">↑ Upward</span>
                      )}
                      {factor.direction === "Downward" && (
                        <span className="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-semibold bg-rose-100 dark:bg-rose-950/40 text-rose-700 dark:text-rose-400 border border-rose-200 dark:border-rose-900/50">↓ Downward</span>
                      )}
                      {factor.direction === "Hard Price Floor" && (
                        <span className="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-semibold bg-amber-100 dark:bg-amber-950/40 text-amber-700 dark:text-amber-400 border border-amber-200 dark:border-amber-900/50">Hard Floor</span>
                      )}
                      {factor.direction === "Neutral" && (
                        <span className="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-400 border border-slate-200 dark:border-slate-700">→ Neutral</span>
                      )}
                    </td>
                    <td className="px-6 py-3.5">
                      {factor.strength === "Strong" && (
                        <span className="inline-flex items-center px-2.5 py-0.5 rounded text-xs font-semibold bg-red-100 dark:bg-red-950/30 text-red-800 dark:text-red-400 border border-red-200 dark:border-red-900/40">Strong</span>
                      )}
                      {factor.strength === "Moderate" && (
                        <span className="inline-flex items-center px-2.5 py-0.5 rounded text-xs font-semibold bg-amber-100 dark:bg-amber-950/30 text-amber-800 dark:text-amber-400 border border-amber-200 dark:border-amber-900/40">Moderate</span>
                      )}
                      {factor.strength === "Weak" && (
                        <span className="inline-flex items-center px-2.5 py-0.5 rounded text-xs font-medium bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-400 border border-slate-200 dark:border-slate-700">Weak</span>
                      )}
                    </td>
                    <td className="px-6 py-3.5 text-xs text-slate-500 dark:text-slate-400 leading-normal">{factor.reason}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>
      )}
    </div>
  );
}
