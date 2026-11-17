import React, { useState, useEffect, useRef } from "react";
import * as XLSX from "xlsx";
import { Calendar, RefreshCw, Printer, Download, Upload } from "lucide-react";

function BalanceSheet() {
  const [startDate, setStartDate] = useState("");
  const [endDate, setEndDate] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  
  const [vendors, setVendors] = useState([]);
  const [loadingVendors, setLoadingVendors] = useState(false);
  const [importing, setImporting] = useState(false); // NEW

  const importInputRef = useRef(null); // NEW
  
  const [currentAssets, setCurrentAssets] = useState([]);
  const [fixedAssets, setFixedAssets] = useState([]);
  const [otherAssets, setOtherAssets] = useState([]);
  
  const [currentLiabilities, setCurrentLiabilities] = useState([]);
  const [longTermLiabilities, setLongTermLiabilities] = useState([]);
  
  const [equity, setEquity] = useState([]);
  
  const [closingStock, setClosingStock] = useState(0);
  const [netProfit, setNetProfit] = useState(null); // null = not loaded yet

  const [totalCurrentAssets, setTotalCurrentAssets] = useState(0);
  const [totalFixedAssets, setTotalFixedAssets] = useState(0);
  const [totalOtherAssets, setTotalOtherAssets] = useState(0);
  const [totalAssets, setTotalAssets] = useState(0);
  
  const [totalCurrentLiabilities, setTotalCurrentLiabilities] = useState(0);
  const [totalLongTermLiabilities, setTotalLongTermLiabilities] = useState(0);
  const [totalLiabilities, setTotalLiabilities] = useState(0);
  
  const [totalEquity, setTotalEquity] = useState(0);
  const [totalLiabilitiesEquity, setTotalLiabilitiesEquity] = useState(0);

  useEffect(() => {
    const today = new Date().toISOString().split("T")[0];
    const firstDayOfYear = new Date(new Date().getFullYear(), 0, 1).toISOString().split("T")[0];
    setStartDate(firstDayOfYear);
    setEndDate(today);
  }, []);

  useEffect(() => {
    if (startDate && endDate) {
      loadVendors();
    }
  }, [startDate, endDate]);

  useEffect(() => {
    if (startDate && endDate && vendors.length >= 0) {
      loadBalanceSheetData();
    }
  }, [startDate, endDate, vendors]);

  const loadVendors = async () => {
    try {
      setLoadingVendors(true);
      console.log("📋 Loading vendors from liabilities...");
      
      const response = await fetch(`https://owaisbackend.duckdns.org/api/chart-of-accounts/liabilities`);
      const data = await response.json();
      
      if (!data.success) {
        throw new Error("Failed to fetch liabilities");
      }

      const liabilities = data.data || [];
      const vendorList = liabilities.filter((liability) => liability.type === "PAYABLES");
      
      setVendors(vendorList);
      console.log(`✅ Loaded ${vendorList.length} vendors from liabilities`);
    } catch (err) {
      console.error("❌ Error loading vendors:", err);
      setVendors([]);
    } finally {
      setLoadingVendors(false);
    }
  };

  const loadClosingStock = async () => {
    try {
      console.log("📦 Fetching Closing Stock from /products/get-stock...");
      const response = await fetch(`https://owaisbackend.duckdns.org/api/products/get-stock`);
      if (!response.ok) throw new Error(`HTTP error! status: ${response.status}`);
      const data = await response.json();
      if (!data.success) { setClosingStock(0); return 0; }
      const products = data.data || [];
      const totalClosingStock = products.reduce((sum, product) => sum + (product.balanceAmount || 0), 0);
      console.log(`📦 Total Closing Stock: ${totalClosingStock}`);
      setClosingStock(totalClosingStock);
      return totalClosingStock;
    } catch (err) {
      console.error("❌ Error loading closing stock:", err);
      setClosingStock(0);
      return 0;
    }
  };

  const loadNetProfit = async () => {
    try {
      console.log("📊 Fetching Net Profit/Loss from P&L API...");
      const response = await fetch(
        `https://owaisbackend.duckdns.org/api/profit-loss?fromDate=${startDate}&toDate=${endDate}`
      );
      if (!response.ok) throw new Error(`HTTP error! status: ${response.status}`);
      const data = await response.json();
      if (!data.success) {
        console.warn("❌ P&L API returned success: false");
        return 0;
      }
      const np = data.data?.summary?.netProfit || 0;
      console.log(`✅ Net Profit/Loss: ${np}`);
      setNetProfit(np);
      return np;
    } catch (err) {
      console.error("❌ Error loading Net Profit:", err);
      setNetProfit(0);
      return 0;
    }
  };

  const loadTaxAccountBalances = async () => {
    const TAX_CODES = [
      { code: "TAX-0025-PAY", name: "Withholding Tax 0.25% Payable", category: "Liabilities", type: "TAX-WHT-PAYABLE" },
      { code: "TAX-0050-PAY", name: "Withholding Tax 0.50% Payable", category: "Liabilities", type: "TAX-WHT-PAYABLE" },
      { code: "TAX-0100-PAY", name: "Withholding Tax 1% Payable",    category: "Liabilities", type: "TAX-WHT-PAYABLE" },
      { code: "TAX-ADV-0025", name: "Advance Tax 0.25%",             category: "Assets",      type: "TAX-ADVANCE"    },
      { code: "TAX-ADV-0050", name: "Advance Tax 0.50%",             category: "Assets",      type: "TAX-ADVANCE"    },
      { code: "TAX-ADV-0100", name: "Advance Tax 1%",                category: "Assets",      type: "TAX-ADVANCE"    },
    ];

    const results = [];

    for (const tax of TAX_CODES) {
      try {
        const params = new URLSearchParams({
          accountCode: tax.code,
          accountName: tax.name,
          fromDate: startDate,
          toDate: endDate,
        });
        const response = await fetch(
          `https://owaisbackend.duckdns.org/api/ledgers/account-ledger?${params}`
        );
        const data = await response.json();
        let balance = 0;
        if (data.success && data.data) {
          balance = Math.abs(data.data.summary?.closingBalance || 0);
        }
        if (balance > 0) {
          results.push({ ...tax, balance, isTaxAccount: true });
          console.log(`✅ Tax Account ${tax.code}: ${balance}`);
        }
      } catch (err) {
        console.error(`❌ Error loading tax account ${tax.code}:`, err);
      }
    }

    return results;
  };

  const loadBalanceSheetData = async () => {
    try {
      setLoading(true);
      setError(null);
      
      console.log(`📊 Fetching Balance Sheet from ${startDate} to ${endDate}`);

      const [stockValue, netProfitValue, taxAccounts] = await Promise.all([
        loadClosingStock(),
        loadNetProfit(),
        loadTaxAccountBalances(),
      ]);

      const accountsResponse = await fetch(`https://owaisbackend.duckdns.org/api/ledgers/accounts`);
      const accountsData = await accountsResponse.json();
      
      if (!accountsData.success) throw new Error("Failed to fetch accounts");

      console.log(`✅ Loaded ${accountsData.count} accounts from ledger`);

      const currentAssetsList = [];
      const fixedAssetsList = [];
      const otherAssetsList = [];
      const currentLiabilitiesList = [];
      const longTermLiabilitiesList = [];
      const equityList = [];

      for (const vendor of vendors) {
        try {
          const params = new URLSearchParams({
            accountCode: vendor.code || "",
            accountName: vendor.name || "",
            fromDate: startDate,
            toDate: endDate,
          });

          const ledgerResponse = await fetch(
            `https://owaisbackend.duckdns.org/api/ledgers/account-ledger?${params}`
          );
          const ledgerData = await ledgerResponse.json();

          let vendorBalance = 0;
          if (ledgerData.success && ledgerData.data) {
            vendorBalance = Math.abs(ledgerData.data.summary?.closingBalance || 0);
          }
          if (vendorBalance === 0) vendorBalance = Math.abs(vendor.balance || 0);
          
          currentLiabilitiesList.push({
            code: vendor.code,
            name: `${vendor.name} (${vendor.code})`,
            originalName: vendor.name,
            type: 'PAYABLES',
            balance: vendorBalance,
            category: 'Liabilities',
            vendorInfo: vendor,
            isVendor: true
          });
        } catch (err) {
          console.error(`Error loading ledger for vendor ${vendor.name}:`, err);
          currentLiabilitiesList.push({
            code: vendor.code,
            name: `${vendor.name} (${vendor.code})`,
            originalName: vendor.name,
            type: 'PAYABLES',
            balance: 0,
            category: 'Liabilities',
            vendorInfo: vendor,
            isVendor: true
          });
        }
      }

      const whtAccounts = taxAccounts.filter(t => t.type === "TAX-WHT-PAYABLE");
      whtAccounts.forEach(wht => {
        currentLiabilitiesList.push({
          code: wht.code,
          name: wht.name,
          originalName: wht.name,
          type: wht.type,
          balance: wht.balance,
          category: 'Liabilities',
          isWHT: true
        });
        console.log(`✅ Added WHT Payable to Current Liabilities: ${wht.name} = ${wht.balance}`);
      });

      const advanceTaxAccounts = taxAccounts.filter(t => t.type === "TAX-ADVANCE");
      advanceTaxAccounts.forEach(adv => {
        currentAssetsList.push({
          code: adv.code,
          name: adv.name,
          originalName: adv.name,
          type: adv.type,
          balance: adv.balance,
          category: 'Assets',
          isAdvanceTax: true
        });
        console.log(`✅ Added Advance Tax to Current Assets: ${adv.name} = ${adv.balance}`);
      });

      accountsData.data.forEach(account => {
        const balance = account.balance || 0;
        const absBalance = Math.abs(balance);
        
        const isVendorAccount = account.category === 'Liabilities' && 
                               (account.type === 'PAYABLES' || account.type?.toLowerCase().includes('payable'));
        if (isVendorAccount) return;

        const isTaxAcc = account.code?.startsWith("TAX-");
        if (isTaxAcc) return;

        if (absBalance === 0) return;

        let displayName = account.name || account.accountName || 'Unknown Account';
        
        if (account.category === 'Assets' && (account.type === 'RECEIVABLES' || account.type?.toLowerCase().includes('receivable'))) {
          displayName = `${displayName} (Customer)`;
        }

        const accountData = {
          code: account.code,
          name: displayName,
          originalName: account.name || account.accountName,
          type: account.type,
          balance: absBalance,
          category: account.category,
          isVendor: false
        };

        if (account.category === 'Assets') {
          const typeLower = (account.type || '').toLowerCase();
          if (typeLower.includes('inventory') || typeLower.includes('stock') ||
              typeLower.includes('raw material') || typeLower.includes('purchases')) {
            return;
          }
          if (typeLower.includes('current') || typeLower.includes('cash') || 
              typeLower.includes('bank') || typeLower.includes('receivable') ||
              typeLower === 'receivables') {
            currentAssetsList.push(accountData);
          } else {
            fixedAssetsList.push(accountData);
          }
        } else if (account.category === 'Liabilities') {
          const typeLower = (account.type || '').toLowerCase();
          if (typeLower.includes('current') || typeLower.includes('payable') ||
              typeLower.includes('short-term')) {
            currentLiabilitiesList.push(accountData);
          } else {
            longTermLiabilitiesList.push(accountData);
          }
        } else if (account.category === 'Equity') {
          equityList.push(accountData);
        }
      });

      currentAssetsList.push({
        code: 'CLOSING_STOCK',
        name: 'Closing Stock (Inventory)',
        originalName: 'Closing Stock',
        type: 'INVENTORY',
        balance: stockValue,
        category: 'Assets',
        isClosingStock: true
      });

      if (netProfitValue !== null) {
        equityList.push({
          code: 'NET_PROFIT',
          name: netProfitValue >= 0 ? 'Net Profit (Current Period)' : 'Net Loss (Current Period)',
          originalName: 'Net Profit/Loss',
          type: 'NET_PROFIT',
          balance: netProfitValue,
          category: 'Equity',
          isNetProfit: true
        });
        console.log(`✅ Added Net Profit/Loss to Equity: ${netProfitValue}`);
      }

      setCurrentAssets(currentAssetsList);
      setFixedAssets(fixedAssetsList);
      setOtherAssets(otherAssetsList);
      setCurrentLiabilities(currentLiabilitiesList);
      setLongTermLiabilities(longTermLiabilitiesList);
      setEquity(equityList);

      const currentAssetsTotal = currentAssetsList.reduce((sum, acc) => sum + acc.balance, 0);
      const fixedAssetsTotal = fixedAssetsList.reduce((sum, acc) => sum + acc.balance, 0);
      const assetsTotal = currentAssetsTotal + fixedAssetsTotal;

      const currentLiabilitiesTotal = currentLiabilitiesList.reduce((sum, acc) => sum + acc.balance, 0);
      const longTermLiabilitiesTotal = longTermLiabilitiesList.reduce((sum, acc) => sum + acc.balance, 0);
      const liabilitiesTotal = currentLiabilitiesTotal + longTermLiabilitiesTotal;

      const equityTotal = equityList.reduce((sum, acc) => sum + acc.balance, 0);
      const liabilitiesEquityTotal = liabilitiesTotal + equityTotal;

      setTotalCurrentAssets(currentAssetsTotal);
      setTotalFixedAssets(fixedAssetsTotal);
      setTotalOtherAssets(0);
      setTotalAssets(assetsTotal);

      setTotalCurrentLiabilities(currentLiabilitiesTotal);
      setTotalLongTermLiabilities(longTermLiabilitiesTotal);
      setTotalLiabilities(liabilitiesTotal);

      setTotalEquity(equityTotal);
      setTotalLiabilitiesEquity(liabilitiesEquityTotal);

      console.log("💰 Balance Sheet Totals:", {
        currentAssets: currentAssetsTotal,
        fixedAssets: fixedAssetsTotal,
        totalAssets: assetsTotal,
        currentLiabilities: currentLiabilitiesTotal,
        longTermLiabilities: longTermLiabilitiesTotal,
        totalLiabilities: liabilitiesTotal,
        equity: equityTotal,
        totalLiabilitiesEquity: liabilitiesEquityTotal,
        closingStock: stockValue,
        netProfit: netProfitValue,
        balanced: Math.abs(assetsTotal - liabilitiesEquityTotal) < 0.01
      });

    } catch (error) {
      console.error("❌ Error loading balance sheet:", error);
      setError(error.message || "Failed to load balance sheet");
    } finally {
      setLoading(false);
    }
  };

  const formatCurrency = (value) => {
    return new Intl.NumberFormat('en-PK', {
      minimumFractionDigits: 2,
      maximumFractionDigits: 2
    }).format(value || 0);
  };

  const formatDateRange = () => {
    if (!startDate || !endDate) return "";
    const start = new Date(startDate);
    const end = new Date(endDate);
    return `From ${start.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })} to ${end.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })}`;
  };

  const handlePrint = () => window.print();

  // ═══════════════════════ NEW: REAL EXCEL EXPORT (.xlsx) ═══════════════════════
  const handleExcelExport = () => {
    const rows = [];

    rows.push({ Section: "ASSETS", Account: "", Amount: "" });
    rows.push({ Section: "Current Assets", Account: "", Amount: "" });
    currentAssets.forEach(a => rows.push({ Section: "", Account: a.name, Amount: a.balance }));
    rows.push({ Section: "", Account: "Total Current Assets", Amount: totalCurrentAssets });

    rows.push({ Section: "Fixed Assets", Account: "", Amount: "" });
    fixedAssets.forEach(a => rows.push({ Section: "", Account: a.name, Amount: a.balance }));
    rows.push({ Section: "", Account: "Total Fixed Assets", Amount: totalFixedAssets });

    rows.push({ Section: "", Account: "TOTAL ASSETS", Amount: totalAssets });
    rows.push({ Section: "", Account: "", Amount: "" });

    rows.push({ Section: "LIABILITIES & EQUITY", Account: "", Amount: "" });
    rows.push({ Section: "Current Liabilities", Account: "", Amount: "" });
    currentLiabilities.forEach(l => rows.push({ Section: "", Account: l.name, Amount: l.balance }));
    rows.push({ Section: "", Account: "Total Current Liabilities", Amount: totalCurrentLiabilities });

    if (longTermLiabilities.length > 0) {
      rows.push({ Section: "Long-Term Liabilities", Account: "", Amount: "" });
      longTermLiabilities.forEach(l => rows.push({ Section: "", Account: l.name, Amount: l.balance }));
      rows.push({ Section: "", Account: "Total Long-Term Liabilities", Amount: totalLongTermLiabilities });
    }

    rows.push({ Section: "Owner's Equity", Account: "", Amount: "" });
    equity.forEach(e => rows.push({ Section: "", Account: e.name, Amount: e.balance }));
    rows.push({ Section: "", Account: "Total Owner's Equity", Amount: totalEquity });

    rows.push({ Section: "", Account: "TOTAL LIABILITIES AND EQUITY", Amount: totalLiabilitiesEquity });

    const worksheet = XLSX.utils.json_to_sheet(rows);
    worksheet["!cols"] = [{ wch: 22 }, { wch: 40 }, { wch: 18 }];

    const workbook = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(workbook, worksheet, "Balance Sheet");
    XLSX.writeFile(workbook, `balance_sheet_${startDate}_${endDate}.xlsx`);
  };

  // ═══════════════════════ NEW: EXCEL IMPORT ═══════════════════════
  const handleImportClick = () => {
    importInputRef.current?.click();
  };

  const handleImportFileChange = async (e) => {
    const file = e.target.files?.[0];
    if (!file) return;

    try {
      setImporting(true);
      const data = await file.arrayBuffer();
      const workbook = XLSX.read(data, { type: "array" });
      const firstSheetName = workbook.SheetNames[0];
      const sheet = workbook.Sheets[firstSheetName];
      const rows = XLSX.utils.sheet_to_json(sheet, { defval: "" });

      if (rows.length === 0) {
        alert("The selected file has no rows to import.");
        return;
      }

      // Expecting columns: Account Code, Account Name, Category, Opening Balance
      // Adjust mapping below to match your Excel's actual column headers.
      const parsedAccounts = rows
        .filter(r => r["Account Code"] || r["code"])
        .map((row) => ({
          code: row["Account Code"] || row["code"] || "",
          name: row["Account Name"] || row["name"] || "",
          category: row["Category"] || row["category"] || "",
          openingBalance: parseFloat(row["Opening Balance"] || row["Amount"] || 0) || 0,
        }));

      // Send parsed rows to backend — adjust endpoint to match your actual API
      const response = await fetch(`https://owaisbackend.duckdns.org/api/ledgers/import-accounts`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ accounts: parsedAccounts }),
      });
      const result = await response.json();

      if (result.success) {
        alert(`Imported ${parsedAccounts.length} accounts successfully.`);
        loadBalanceSheetData();
      } else {
        alert("Import failed. Please check the file format and try again.");
      }
    } catch (error) {
      alert(`Failed to import file: ${error.message}`);
    } finally {
      setImporting(false);
      e.target.value = "";
    }
  };

  const vendorCount = currentLiabilities.filter(l => l.isVendor).length;

  return (
    <div style={{ maxWidth: "1000px", margin: "0 auto", padding: "20px", fontFamily: "system-ui, -apple-system, sans-serif" }}>
      {/* Hidden file input for Excel import */}
      <input
        ref={importInputRef}
        type="file"
        accept=".xlsx,.xls,.csv"
        style={{ display: "none" }}
        onChange={handleImportFileChange}
      />

      {/* Header Controls */}
      <div style={{ marginBottom: "30px", padding: "20px", backgroundColor: "#f8f9fa", borderRadius: "8px", boxShadow: "0 2px 4px rgba(0,0,0,0.1)" }}>
        <div style={{ display: "flex", alignItems: "flex-start", gap: "15px", flexWrap: "wrap" }}>
          <div style={{ flex: "1", minWidth: "200px" }}>
            <label style={{ display: "block", marginBottom: "8px", fontWeight: "600", color: "#495057", fontSize: "14px" }}>
              <Calendar style={{ width: "16px", height: "16px", display: "inline", marginRight: "5px" }} />
              Start Date:
            </label>
            <input type="date" value={startDate} onChange={e => setStartDate(e.target.value)}
              style={{ width: "100%", padding: "10px 12px", border: "2px solid #dee2e6", borderRadius: "6px", fontSize: "14px", fontWeight: "500" }} />
          </div>
          <div style={{ flex: "1", minWidth: "200px" }}>
            <label style={{ display: "block", marginBottom: "8px", fontWeight: "600", color: "#495057", fontSize: "14px" }}>
              <Calendar style={{ width: "16px", height: "16px", display: "inline", marginRight: "5px" }} />
              End Date:
            </label>
            <input type="date" value={endDate} onChange={e => setEndDate(e.target.value)}
              style={{ width: "100%", padding: "10px 12px", border: "2px solid #dee2e6", borderRadius: "6px", fontSize: "14px", fontWeight: "500" }} />
          </div>
          <button onClick={() => { loadVendors(); loadBalanceSheetData(); }}
            disabled={loading || loadingVendors || !startDate || !endDate}
            style={{ padding: "10px 20px", backgroundColor: loading || loadingVendors ? "#6c757d" : "#0d6efd", color: "white", border: "none", borderRadius: "6px", cursor: loading || loadingVendors ? "not-allowed" : "pointer", fontWeight: "500", fontSize: "14px", display: "flex", alignItems: "center", gap: "8px", marginTop: "24px" }}>
            <RefreshCw style={{ width: "16px", height: "16px" }} />
            {loading || loadingVendors ? "Loading..." : "Refresh Data"}
          </button>
          <button onClick={handleImportClick} disabled={importing}
            style={{ padding: "10px 20px", backgroundColor: importing ? "#6c757d" : "#6f42c1", color: "white", border: "none", borderRadius: "6px", cursor: importing ? "not-allowed" : "pointer", fontWeight: "500", fontSize: "14px", display: "flex", alignItems: "center", gap: "8px", marginTop: "24px" }}>
            <Upload style={{ width: "16px", height: "16px" }} />
            {importing ? "Importing..." : "Import Excel"}
          </button>
          <button onClick={handleExcelExport} disabled={loading || loadingVendors}
            style={{ padding: "10px 20px", backgroundColor: "#fd7e14", color: "white", border: "none", borderRadius: "6px", cursor: loading || loadingVendors ? "not-allowed" : "pointer", fontWeight: "500", fontSize: "14px", display: "flex", alignItems: "center", gap: "8px", marginTop: "24px" }}>
            <Download style={{ width: "16px", height: "16px" }} />
            Export Excel
          </button>
          <button onClick={handlePrint} disabled={loading || loadingVendors}
            style={{ padding: "10px 20px", backgroundColor: "#198754", color: "white", border: "none", borderRadius: "6px", cursor: loading || loadingVendors ? "not-allowed" : "pointer", fontWeight: "500", fontSize: "14px", display: "flex", alignItems: "center", gap: "8px", marginTop: "24px" }}>
            <Printer style={{ width: "16px", height: "16px" }} />
            Print
          </button>
        </div>
      </div>

      {/* Error */}
      {error && (
        <div style={{ padding: "15px", backgroundColor: "#f8d7da", color: "#721c24", border: "1px solid #f5c6cb", borderRadius: "6px", marginBottom: "20px" }}>
          ⚠️ {error}
        </div>
      )}

      {/* Title */}
      <h2 style={{ color: "#2c5ca9", textAlign: "center", marginBottom: "5px", fontWeight: "700", fontSize: "28px", letterSpacing: "-0.5px" }}>
        demo<br />Balance Sheet
      </h2>
      <p style={{ textAlign: "center", fontWeight: "500", fontSize: "14px", color: "#6c757d", marginBottom: "40px" }}>
        {formatDateRange()}
      </p>

      {/* Loading */}
      {loading ? (
        <div style={{ textAlign: "center", padding: "40px", color: "#6c757d" }}>
          <div style={{ display: "inline-block", width: "40px", height: "40px", border: "4px solid #f3f3f3", borderTop: "4px solid #3f64a8", borderRadius: "50%", animation: "spin 1s linear infinite" }} />
          <style>{`@keyframes spin { 0% { transform: rotate(0deg); } 100% { transform: rotate(360deg); } }`}</style>
          <p style={{ marginTop: "15px" }}>Loading Balance Sheet...</p>
        </div>
      ) : (
        <>
          <div style={{ backgroundColor: "#3f64a8", color: "white", fontWeight: "bold", padding: "10px 15px", fontSize: "16px" }}>
            Assets
          </div>

          <div style={{ background: "#e6edf8", fontWeight: "700", padding: "8px 15px", marginTop: "10px" }}>
            Current Assets
          </div>
          <div style={{ paddingLeft: "25px", lineHeight: "1.8", backgroundColor: "#fff" }}>
            {currentAssets.length > 0 ? currentAssets.map((asset, index) => (
              <div key={index} style={{
                display: "flex", justifyContent: "space-between", padding: "6px 15px 6px 0",
                borderBottom: "1px solid #f0f0f0",
                backgroundColor: asset.isClosingStock ? "#f0fff4" : asset.isAdvanceTax ? "#f0f8ff" : "#fff"
              }}>
                <span style={{ fontSize: "15px", color: "#000", fontWeight: (asset.isClosingStock || asset.isAdvanceTax) ? "600" : "normal" }}>
                  {asset.name}
                  {asset.isClosingStock && <span style={{ fontSize: "11px", color: "#16a34a", marginLeft: "8px" }}>[From Products Stock]</span>}
                  {asset.isAdvanceTax && <span style={{ fontSize: "11px", color: "#1d4ed8", marginLeft: "8px" }}>[Advance Tax - Asset]</span>}
                </span>
                <span style={{ fontSize: "15px", color: asset.isClosingStock ? "#16a34a" : asset.isAdvanceTax ? "#1d4ed8" : "#000", fontFamily: "monospace", minWidth: "120px", textAlign: "right", fontWeight: (asset.isClosingStock || asset.isAdvanceTax) ? "600" : "normal" }}>
                  {formatCurrency(asset.balance)}
                </span>
              </div>
            )) : (
              <div style={{ padding: "10px 0", color: "#999", fontSize: "14px" }}>No current assets</div>
            )}
          </div>
          <div style={{ display: "flex", justifyContent: "space-between", padding: "10px 15px", backgroundColor: "#f8f9fa", fontWeight: "600", borderTop: "1px solid #dee2e6" }}>
            <span>Total Current Assets</span>
            <span style={{ fontFamily: "monospace" }}>{formatCurrency(totalCurrentAssets)}</span>
          </div>

          <div style={{ background: "#e6edf8", fontWeight: "700", padding: "8px 15px", marginTop: "15px" }}>
            Fixed (Long-Term) Assets
          </div>
          <div style={{ paddingLeft: "25px", lineHeight: "1.8", backgroundColor: "#fff" }}>
            {fixedAssets.length > 0 ? fixedAssets.map((asset, index) => (
              <div key={index} style={{ display: "flex", justifyContent: "space-between", padding: "6px 15px 6px 0", borderBottom: "1px solid #f0f0f0" }}>
                <span style={{ fontSize: "15px", color: "#000" }}>{asset.name}</span>
                <span style={{ fontSize: "15px", color: "#000", fontFamily: "monospace", minWidth: "120px", textAlign: "right" }}>{formatCurrency(asset.balance)}</span>
              </div>
            )) : (
              <div style={{ padding: "10px 0", color: "#999", fontSize: "14px" }}>No fixed assets</div>
            )}
          </div>
          <div style={{ display: "flex", justifyContent: "space-between", padding: "10px 15px", backgroundColor: "#f8f9fa", fontWeight: "600", borderTop: "1px solid #dee2e6" }}>
            <span>Total Fixed Assets</span>
            <span style={{ fontFamily: "monospace" }}>{formatCurrency(totalFixedAssets)}</span>
          </div>

          <div style={{ display: "flex", justifyContent: "space-between", padding: "15px", backgroundColor: "#d1e7dd", fontWeight: "700", fontSize: "17px", marginTop: "15px", borderTop: "2px solid #0f5132", borderBottom: "2px solid #0f5132" }}>
            <span>TOTAL ASSETS</span>
            <span style={{ fontFamily: "monospace", color: "#0f5132" }}>{formatCurrency(totalAssets)}</span>
          </div>

          <div style={{ backgroundColor: "#3f64a8", color: "white", fontWeight: "bold", padding: "10px 15px", fontSize: "16px", marginTop: "30px" }}>
            Liabilities and Owner's Equity
          </div>

          <div style={{ background: "#e6edf8", fontWeight: "700", padding: "8px 15px", marginTop: "10px" }}>
            Current Liabilities ({vendorCount} vendors)
          </div>
          <div style={{ paddingLeft: "25px", lineHeight: "1.8", backgroundColor: "#fff" }}>
            {currentLiabilities.length > 0 ? currentLiabilities.map((liability, index) => (
              <div key={index} style={{
                display: "flex", justifyContent: "space-between", padding: "6px 15px 6px 0",
                borderBottom: "1px solid #f0f0f0",
                backgroundColor: liability.isVendor ? "#fff8f0" : liability.isWHT ? "#fff0f5" : "#fff"
              }}>
                <span style={{ fontSize: "15px", color: "#000" }}>
                  {liability.name}
                  {liability.isVendor && <span style={{ fontSize: "11px", color: "#666", marginLeft: "8px" }}>[Vendor Payable]</span>}
                  {liability.isWHT && <span style={{ fontSize: "11px", color: "#9333ea", marginLeft: "8px" }}>[WHT Payable]</span>}
                </span>
                <span style={{ fontSize: "15px", color: liability.isVendor ? "#d63384" : liability.isWHT ? "#9333ea" : "#000", fontFamily: "monospace", minWidth: "120px", textAlign: "right", fontWeight: (liability.isVendor || liability.isWHT) ? "600" : "normal" }}>
                  {formatCurrency(liability.balance)}
                </span>
              </div>
            )) : (
              <div style={{ padding: "10px 0", color: "#999", fontSize: "14px" }}>No current liabilities</div>
            )}
          </div>
          <div style={{ display: "flex", justifyContent: "space-between", padding: "10px 15px", backgroundColor: "#f8f9fa", fontWeight: "600", borderTop: "1px solid #dee2e6" }}>
            <span>Total Current Liabilities</span>
            <span style={{ fontFamily: "monospace" }}>{formatCurrency(totalCurrentLiabilities)}</span>
          </div>

          {longTermLiabilities.length > 0 && (
            <>
              <div style={{ background: "#e6edf8", fontWeight: "700", padding: "8px 15px", marginTop: "15px" }}>
                Long-Term Liabilities
              </div>
              <div style={{ paddingLeft: "25px", lineHeight: "1.8", backgroundColor: "#fff" }}>
                {longTermLiabilities.map((liability, index) => (
                  <div key={index} style={{ display: "flex", justifyContent: "space-between", padding: "6px 15px 6px 0", borderBottom: "1px solid #f0f0f0" }}>
                    <span style={{ fontSize: "15px", color: "#000" }}>{liability.name}</span>
                    <span style={{ fontSize: "15px", color: "#000", fontFamily: "monospace", minWidth: "120px", textAlign: "right" }}>{formatCurrency(liability.balance)}</span>
                  </div>
                ))}
              </div>
              <div style={{ display: "flex", justifyContent: "space-between", padding: "10px 15px", backgroundColor: "#f8f9fa", fontWeight: "600", borderTop: "1px solid #dee2e6" }}>
                <span>Total Long-Term Liabilities</span>
                <span style={{ fontFamily: "monospace" }}>{formatCurrency(totalLongTermLiabilities)}</span>
              </div>
            </>
          )}

          <div style={{ background: "#e6edf8", fontWeight: "700", padding: "8px 15px", marginTop: "15px" }}>
            Owner's Equity
          </div>
          <div style={{ paddingLeft: "25px", lineHeight: "1.8", backgroundColor: "#fff" }}>
            {equity.length > 0 ? equity.map((eq, index) => (
              <div key={index} style={{
                display: "flex", justifyContent: "space-between", padding: "6px 15px 6px 0",
                borderBottom: "1px solid #f0f0f0",
                backgroundColor: eq.isNetProfit
                  ? (eq.balance >= 0 ? "#f0fff4" : "#fff5f5")
                  : "#fff"
              }}>
                <span style={{ fontSize: "15px", color: "#000", fontWeight: eq.isNetProfit ? "700" : "normal" }}>
                  {eq.name}
                  {eq.isNetProfit && (
                    <span style={{ fontSize: "11px", marginLeft: "8px", color: eq.balance >= 0 ? "#16a34a" : "#dc2626" }}>
                      [{eq.balance >= 0 ? "Profit" : "Loss"} — from P&L]
                    </span>
                  )}
                </span>
                <span style={{
                  fontSize: "15px",
                  color: eq.isNetProfit ? (eq.balance >= 0 ? "#16a34a" : "#dc2626") : "#000",
                  fontFamily: "monospace",
                  minWidth: "120px",
                  textAlign: "right",
                  fontWeight: eq.isNetProfit ? "700" : "normal"
                }}>
                  {eq.isNetProfit && eq.balance < 0 ? `(${formatCurrency(Math.abs(eq.balance))})` : formatCurrency(eq.balance)}
                </span>
              </div>
            )) : (
              <div style={{ padding: "10px 0", color: "#999", fontSize: "14px" }}>No equity accounts</div>
            )}
          </div>
          <div style={{ display: "flex", justifyContent: "space-between", padding: "10px 15px", backgroundColor: "#f8f9fa", fontWeight: "600", borderTop: "1px solid #dee2e6" }}>
            <span>Total Owner's Equity</span>
            <span style={{ fontFamily: "monospace", color: totalEquity < 0 ? "#dc2626" : "inherit" }}>
              {totalEquity < 0 ? `(${formatCurrency(Math.abs(totalEquity))})` : formatCurrency(totalEquity)}
            </span>
          </div>

          <div style={{ display: "flex", justifyContent: "space-between", padding: "15px", backgroundColor: "#cfe2ff", fontWeight: "700", fontSize: "17px", marginTop: "15px", borderTop: "2px solid #084298", borderBottom: "2px solid #084298" }}>
            <span>TOTAL LIABILITIES AND OWNER'S EQUITY</span>
            <span style={{ fontFamily: "monospace", color: "#084298" }}>
              {formatCurrency(totalLiabilitiesEquity)}
            </span>
          </div>

          {Math.abs(totalAssets - totalLiabilitiesEquity) > 0.01 ? (
            <div style={{ marginTop: "20px", padding: "15px", backgroundColor: "#fff3cd", border: "1px solid #ffc107", borderRadius: "6px", color: "#856404" }}>
              ⚠️ Balance Sheet is not balanced!
              <br />Difference: {formatCurrency(Math.abs(totalAssets - totalLiabilitiesEquity))}
            </div>
          ) : (
            <div style={{ marginTop: "20px", padding: "15px", backgroundColor: "#d1e7dd", border: "1px solid #198754", borderRadius: "6px", color: "#0f5132" }}>
              ✅ Balance Sheet is balanced!
            </div>
          )}
        </>
      )}
    </div>
  );
}

export default BalanceSheet;