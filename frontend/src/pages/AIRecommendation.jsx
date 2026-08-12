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

  const getMainReason = (report) => {
    if (!report) return "";
    const recPrice = report.recommended_price || 0;
    const minPrice = report.minimum_allowed_price || 0;
    const compPrice = report.competitor_price;
    const supply = report.days_of_supply || 0;
    const trend = report.demand_trend || "";

    if (Math.abs(recPrice - minPrice) < 0.1) {
      return "Minimum margin sets the lowest safe price.";
    }
    if (supply > 30 && compPrice !== null && compPrice !== undefined && compPrice > 0 && Math.abs(recPrice - Math.max(compPrice, minPrice)) < 0.1) {
      return "Competitor pricing is putting downward pressure on the recommended price.";
    }
    if (supply > 30) {
      return "High inventory is encouraging a lower price to increase sales.";
    }
    if (trend === "Increasing" || trend === "Seasonal") {
      return "Strong demand allows the system to consider a higher price.";
    }
    return "The price is selected to balance demand, revenue, and profit.";
  };

  const getDynamicExplanation = (report) => {
    if (!report) return "";
    const recPrice = report.recommended_price || 0;
    const minPrice = report.minimum_allowed_price || 0;
    const compPrice = report.competitor_price;
    const supply = report.days_of_supply || 0;

    let parts = [];
    if (supply > 30) {
      parts.push("high inventory");
    }
    if (compPrice !== null && compPrice !== undefined && compPrice > 0 && compPrice < report.current_price) {
      parts.push("competitor pressure");
    }

    const factorsText = parts.length > 0 ? parts.join(" and ") + " are pushing the price lower" : "market demand and price optimization determine the target price";

    if (Math.abs(recPrice - minPrice) < 0.1) {
      return `${factorsText.charAt(0).toUpperCase() + factorsText.slice(1)}. The minimum margin rule prevents the price from going below ${formatCurrency(minPrice)}.`;
    }
    if (supply > 30 && compPrice !== null && compPrice !== undefined && compPrice > 0 && Math.abs(recPrice - Math.max(compPrice, minPrice)) < 0.1) {
      return `${factorsText.charAt(0).toUpperCase() + factorsText.slice(1)}. The recommended price matches the competitor price cap of ${formatCurrency(compPrice)}.`;
    }
    return `The price of ${formatCurrency(recPrice)} is selected to balance expected demand, revenue, and profit margin.`;
  };

  const getColorClasses = (color) => {
    switch (color) {
      case "green":
        return "bg-emerald-50 text-emerald-700 dark:bg-emerald-950/20 dark:text-emerald-400 border border-emerald-200 dark:border-emerald-900/40";
      case "red":
        return "bg-rose-50 text-rose-700 dark:bg-rose-950/20 dark:text-rose-400 border border-rose-200 dark:border-rose-900/40";
      case "yellow":
        return "bg-amber-50 text-amber-700 dark:bg-amber-950/20 dark:text-amber-400 border border-amber-250 dark:border-amber-900/40";
      case "blue":
      default:
        return "bg-sky-50 text-sky-700 dark:bg-sky-950/20 dark:text-sky-400 border border-sky-200 dark:border-sky-900/40";
    }
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

    const list = [];

    // 1. Expected Demand
    list.push({
      name: "Expected Demand",
      value: `${report.expected_demand.toFixed(1)} units`,
      meaning: "Expected sales volume supports the pricing decision.",
      color: "blue"
    });

    // 2. Competitor Price
    let compValue = "—";
    let compMeaning = "No active competitor price detected.";
    let compColor = "blue";
    if (compPrice !== null && compPrice !== undefined && compPrice > 0) {
      compValue = formatCurrency(compPrice);
      if (compPrice < currPrice) {
        compMeaning = "Competitor is cheaper → pricing pressure is high.";
        compColor = "red";
      } else {
        compMeaning = "Competitor is more expensive → there is room for a higher price.";
        compColor = "green";
      }
    }
    list.push({
      name: "Competitor Price",
      value: compValue,
      meaning: compMeaning,
      color: compColor
    });

    // 3. Minimum Safe Price
    list.push({
      name: "Minimum Safe Price",
      value: formatCurrency(minPrice),
      meaning: "Price cannot go below the minimum margin requirement.",
      color: "yellow"
    });

    // 4. Inventory
    let invValue = `${stock} units (${supply.toFixed(1)} days)`;
    let invMeaning = "";
    let invColor = "blue";
    if (supply > 30) {
      invColor = "red";
      if (histSales > 0) {
        invMeaning = `High inventory → lower pricing can help clear stock. (Stock: ${stock} units, Velocity: ${dailyVel.toFixed(2)} units/day = ${histSales.toFixed(0)} / 30. Days of supply: ${stock} / ${dailyVel.toFixed(2)} = ${supply.toFixed(1)} days)`;
      } else {
        invMeaning = "High inventory → lower pricing can help clear stock.";
      }
    } else {
      if (histSales > 0) {
        invMeaning = `Inventory is healthy → price does not need to be reduced for stock clearance. (Stock: ${stock} units, Velocity: ${dailyVel.toFixed(2)} units/day = ${histSales.toFixed(0)} / 30. Days of supply: ${stock} / ${dailyVel.toFixed(2)} = ${supply.toFixed(1)} days)`;
      } else {
        invMeaning = "Inventory is healthy → price does not need to be reduced for stock clearance.";
      }
    }
    list.push({
      name: "Inventory",
      value: invValue,
      meaning: invMeaning,
      color: invColor
    });

    // 5. Price Sensitivity
    let sensMeaning = "Customers are not highly price-sensitive.";
    let sensColor = "blue";
    if (elasticity < -1.0) {
      sensMeaning = "Customers are price-sensitive → a lower price can increase sales volume.";
      sensColor = "red";
    }
    list.push({
      name: "Price Sensitivity",
      value: String(elasticity),
      meaning: sensMeaning,
      color: sensColor
    });

    // 6. Demand Trend
    list.push({
      name: "Demand Trend",
      value: trend,
      meaning: "Seasonal demand is considered.",
      color: "blue"
    });

    // 7. Seasonality
    let seasMeaning = "Seasonal fluctuations are stable.";
    let seasColor = "blue";
    if (seasonality === "Strong" || seasonality === "High") {
      seasMeaning = "Strong seasonality can support pricing flexibility.";
      seasColor = "green";
    }
    list.push({
      name: "Seasonality",
      value: seasonality,
      meaning: seasMeaning,
      color: seasColor
    });

    // 8. Forecast Confidence
    list.push({
      name: "Forecast Confidence",
      value: confidence ? `${confidence.toFixed(2)}%` : "N/A",
      meaning: confidence > 80 ? "Forecast has high confidence." : "Forecast has standard confidence.",
      color: confidence > 80 ? "green" : "blue"
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
        <section className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl p-6 text-left text-slate-900 dark:text-white shadow-sm relative overflow-hidden space-y-6 animate-fade-in">
          <div className="absolute top-0 right-0 w-60 h-60 bg-violet-600/10 rounded-full filter blur-3xl -translate-y-1/2 translate-x-1/2"></div>
          
          <div className="relative space-y-4">
            <h2 className="text-sm font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400 border-b border-slate-100 dark:border-slate-800 pb-2">Why This Price?</h2>
            
            <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 bg-slate-50 dark:bg-slate-950/40 p-5 rounded-2xl border border-slate-100 dark:border-slate-850">
              <div className="space-y-1">
                <span className="text-xs font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-wider block">AI Recommended Price</span>
                <span className="text-3xl font-extrabold text-violet-600 dark:text-violet-400 block">
                  {formatCurrency(recommendation.pricing_analysis_report.recommended_price)}
                </span>
              </div>
              
              <div className="p-4 rounded-xl border border-amber-200 dark:border-amber-900/40 bg-amber-50/50 dark:bg-amber-950/20">
                <span className="text-[10px] font-bold uppercase tracking-wider text-amber-600 dark:text-amber-400 block mb-1">Main Reason For This Price</span>
                <p className="text-xs font-bold text-slate-800 dark:text-slate-200">
                  {getMainReason(recommendation.pricing_analysis_report)}
                </p>
              </div>
            </div>

            <p className="text-sm text-slate-750 dark:text-slate-350 leading-relaxed font-medium bg-slate-50/50 dark:bg-slate-900 p-4 rounded-xl border border-slate-100 dark:border-slate-850">
              {getDynamicExplanation(recommendation.pricing_analysis_report)}
            </p>
          </div>

          <div className="relative border border-slate-200 dark:border-slate-800 rounded-xl overflow-hidden bg-slate-50/20 dark:bg-slate-950/40">
            <table className="w-full text-sm text-left text-slate-700 dark:text-slate-300">
              <thead className="text-xs uppercase bg-slate-50 dark:bg-slate-950 text-slate-500 dark:text-slate-400 border-b border-slate-200 dark:border-slate-800">
                <tr>
                  <th className="px-6 py-3.5 font-semibold">Factor</th>
                  <th className="px-6 py-3.5 font-semibold">Value</th>
                  <th className="px-6 py-3.5 font-semibold">What It Means</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 dark:divide-slate-800/60 text-slate-750 dark:text-slate-350 bg-white dark:bg-slate-900">
                {getFactorsList(recommendation.pricing_analysis_report).map((factor, idx) => (
                  <tr key={idx} className="hover:bg-slate-50/50 dark:hover:bg-slate-800/30">
                    <td className="px-6 py-3.5 font-semibold text-slate-900 dark:text-white">
                      {factor.name}
                    </td>
                    <td className="px-6 py-3.5">
                      <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-bold ${getColorClasses(factor.color)}`}>
                        {factor.value}
                      </span>
                    </td>
                    <td className="px-6 py-3.5 text-xs text-slate-600 dark:text-slate-400 leading-relaxed font-medium">
                      {factor.meaning}
                    </td>
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
