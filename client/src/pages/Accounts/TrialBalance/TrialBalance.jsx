"use client"

import React, { useState, useEffect, useRef } from "react"
import * as XLSX from "xlsx"
import {
  Search,
  Download,
  Upload,
  Printer,
  RefreshCw,
} from "lucide-react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"

const API_BASE_URL = "https://owaisbackend381.duckdns.org/api"
const format = (n) => {
  const num = Number.parseFloat(n) || 0
  return num === 0 ? "0" : num.toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 })
}

export default function TrialBalanceIntegrated() {
  const [startDate, setStartDate] = useState(() => {
    const today = new Date()
    const firstDay = new Date(today.getFullYear(), today.getMonth(), 1)
    return firstDay.toISOString().split("T")[0]
  })
  const [endDate, setEndDate] = useState(() => {
    const today = new Date()
    return today.toISOString().split("T")[0]
  })

  const [trialBalanceData, setTrialBalanceData] = useState([])
  const [loading, setLoading] = useState(false)
  const [searchTerm, setSearchTerm] = useState("")
  const [error, setError] = useState(null)
  const [importing, setImporting] = useState(false) // NEW

  const importInputRef = useRef(null) // NEW — hidden file input for Excel import

  useEffect(() => {
    const style = document.createElement('style')
    style.textContent = `
      @media print {
        body * { visibility: hidden; }
        .print-container, .print-container * { visibility: visible; }
        .print-container {
          position: absolute;
          left: 0;
          top: 0;
          width: 100%;
          background: white !important;
        }
        .no-print { display: none !important; }
        .print-table { page-break-inside: auto; }
        .print-table tr { page-break-inside: avoid; page-break-after: auto; }
        @page { margin: 1cm; size: A4 landscape; }
        table { width: 100%; font-size: 10pt; }
        th, td { padding: 4px 8px !important; }
      }
    `
    document.head.appendChild(style)
    return () => document.head.removeChild(style)
  }, [])

  useEffect(() => {
    if (startDate && endDate) {
      calculateTrialBalance()
    }
  }, [startDate, endDate])

  const calculateTrialBalance = async () => {
    if (!startDate || !endDate) return

    setLoading(true)
    setError(null)
    
    try {
      console.log("📊 Fetching all accounts from ledger API...")
      
      const accountsResponse = await fetch(`${API_BASE_URL}/ledgers/accounts`)
      const accountsData = await accountsResponse.json()
      
      if (!accountsData.success) {
        throw new Error("Failed to fetch accounts")
      }

      console.log(`✅ Loaded ${accountsData.count} accounts`)

      const trialBalanceEntries = await Promise.all(
        accountsData.data.map(async (account) => {
          try {
            const params = new URLSearchParams({
              accountCode: account.code || "",
              accountName: account.name || "",
              fromDate: startDate,
              toDate: endDate,
            })

            const ledgerResponse = await fetch(
              `${API_BASE_URL}/ledgers/account-ledger?${params}`
            )
            const ledgerData = await ledgerResponse.json()

            if (!ledgerData.success) {
              return null
            }

            let currentDebit = 0
            let currentCredit = 0

            ledgerData.data.entries.forEach((entry) => {
              currentDebit += entry.debit || 0
              currentCredit += entry.credit || 0
            })

            const openingBalance = ledgerData.data.summary.openingBalance || 0
            const closingBalance = ledgerData.data.summary.closingBalance || 0

            const normalBalance = account.normalBalance || (account.category === 'Assets' || account.category === 'Expenses' ? 'debit' : 'credit')
            
            let openingDebit = 0
            let openingCredit = 0
            
            if (openingBalance > 0) {
              if (normalBalance === 'debit') {
                openingDebit = openingBalance
              } else {
                openingCredit = openingBalance
              }
            } else if (openingBalance < 0) {
              if (normalBalance === 'debit') {
                openingCredit = Math.abs(openingBalance)
              } else {
                openingDebit = Math.abs(openingBalance)
              }
            }

            let closingDebit = 0
            let closingCredit = 0
            
            if (closingBalance > 0) {
              if (normalBalance === 'debit') {
                closingDebit = closingBalance
              } else {
                closingCredit = closingBalance
              }
            } else if (closingBalance < 0) {
              if (normalBalance === 'debit') {
                closingCredit = Math.abs(closingBalance)
              } else {
                closingDebit = Math.abs(closingBalance)
              }
            }

            if (account.code === 'PURCH-DISC' || account.name === 'PURCHASES DISCOUNT') {
              console.log(`🔧 Fixing Purchase Discount display:`, {
                code: account.code,
                currentDebit,
                currentCredit,
                closingBalance,
                normalBalance,
                category: account.category
              })
              
              if (closingBalance !== 0) {
                closingDebit = 0
                closingCredit = Math.abs(closingBalance)
              }
              
              console.log(`✅ After fix - ClosingDebit: ${closingDebit}, ClosingCredit: ${closingCredit}`)
            }

            if (account.code === 'SALES-DISC' || account.name === 'SALES DISCOUNT') {
              console.log(`🔧 Fixing Sales Discount display:`, {
                code: account.code,
                currentDebit,
                currentCredit,
                closingBalance,
                normalBalance,
                category: account.category
              })
              
              if (closingBalance !== 0) {
                closingCredit = 0
                closingDebit = Math.abs(closingBalance)
              }
              
              console.log(`✅ After fix - ClosingDebit: ${closingDebit}, ClosingCredit: ${closingCredit}`)
            }

            const hasActivity = currentDebit > 0 || currentCredit > 0 || openingBalance !== 0

            return {
              code: account.code,
              name: account.name,
              category: account.category,
              normalBalance,
              openingDebit,
              openingCredit,
              currentDebit,
              currentCredit,
              closingDebit,
              closingCredit,
              hasActivity,
            }
          } catch (error) {
            console.error(`Error fetching ledger for ${account.name}:`, error)
            return null
          }
        })
      )

      const activeAccounts = trialBalanceEntries.filter(
        (entry) => entry !== null && entry.hasActivity
      )

      console.log(`\n📊 Final Trial Balance Summary:`)
      activeAccounts.forEach(acc => {
        if (acc.code === 'PURCH-DISC' || acc.code === 'SALES-DISC') {
          console.log(`  ${acc.code}: Current Dr=${acc.currentDebit}, Cr=${acc.currentCredit} | Closing Dr=${acc.closingDebit}, Cr=${acc.closingCredit}`)
        }
      })

      setTrialBalanceData(activeAccounts)
      console.log(`✅ Trial Balance calculated with ${activeAccounts.length} active accounts`)
      
    } catch (error) {
      console.error("Error calculating trial balance:", error)
      setError("Failed to calculate trial balance: " + error.message)
    } finally {
      setLoading(false)
    }
  }

  const formatDate = (date) => {
    const options = { day: "2-digit", month: "short", year: "numeric" }
    return new Date(date).toLocaleDateString("en-GB", options).replace(/ /g, "-")
  }

  const filteredData = trialBalanceData.filter(
    (row) =>
      (row.code && row.code.toLowerCase().includes(searchTerm.toLowerCase())) ||
      (row.name && row.name.toLowerCase().includes(searchTerm.toLowerCase())) ||
      (row.category && row.category.toLowerCase().includes(searchTerm.toLowerCase()))
  )

  const totals = filteredData.reduce(
    (acc, row) => ({
      openingDebit: acc.openingDebit + (row.openingDebit || 0),
      openingCredit: acc.openingCredit + (row.openingCredit || 0),
      currentDebit: acc.currentDebit + (row.currentDebit || 0),
      currentCredit: acc.currentCredit + (row.currentCredit || 0),
      closingDebit: acc.closingDebit + (row.closingDebit || 0),
      closingCredit: acc.closingCredit + (row.closingCredit || 0),
    }),
    {
      openingDebit: 0,
      openingCredit: 0,
      currentDebit: 0,
      currentCredit: 0,
      closingDebit: 0,
      closingCredit: 0,
    }
  )

  // ═══════════════════════ NEW: REAL EXCEL EXPORT (.xlsx) ═══════════════════════
  const handleExcelExport = () => {
    if (filteredData.length === 0) {
      alert("No data to export.")
      return
    }

    const rows = filteredData.map((row) => ({
      "Account Code": row.code,
      "Account Name": row.name,
      "Category": row.category,
      "Opening Debit": row.openingDebit || "",
      "Opening Credit": row.openingCredit || "",
      "Current Debit": row.currentDebit || "",
      "Current Credit": row.currentCredit || "",
      "Closing Debit": row.closingDebit || "",
      "Closing Credit": row.closingCredit || "",
    }))

    // Totals row
    rows.push({
      "Account Code": "TOTAL",
      "Account Name": "",
      "Category": "",
      "Opening Debit": totals.openingDebit,
      "Opening Credit": totals.openingCredit,
      "Current Debit": totals.currentDebit,
      "Current Credit": totals.currentCredit,
      "Closing Debit": totals.closingDebit,
      "Closing Credit": totals.closingCredit,
    })

    const worksheet = XLSX.utils.json_to_sheet(rows)

    worksheet["!cols"] = [
      { wch: 14 }, { wch: 28 }, { wch: 14 },
      { wch: 14 }, { wch: 14 }, { wch: 14 },
      { wch: 14 }, { wch: 14 }, { wch: 14 },
    ]

    const workbook = XLSX.utils.book_new()
    XLSX.utils.book_append_sheet(workbook, worksheet, "Trial Balance")
    XLSX.writeFile(workbook, `trial_balance_${startDate}_${endDate}.xlsx`)
  }

  // ═══════════════════════ NEW: EXCEL IMPORT ═══════════════════════
  const handleImportClick = () => {
    importInputRef.current?.click()
  }

  const handleImportFileChange = async (e) => {
    const file = e.target.files?.[0]
    if (!file) return

    try {
      setImporting(true)
      const data = await file.arrayBuffer()
      const workbook = XLSX.read(data, { type: "array" })
      const firstSheetName = workbook.SheetNames[0]
      const sheet = workbook.Sheets[firstSheetName]
      const rows = XLSX.utils.sheet_to_json(sheet, { defval: "" })

      if (rows.length === 0) {
        alert("The selected file has no rows to import.")
        return
      }

      // Expecting columns like: Account Code, Account Name, Category, Opening Debit/Credit
      // Adjust the mapping below to match your Excel's actual column headers.
      const parsedAccounts = rows.map((row) => ({
        code: row["Account Code"] || row["code"] || "",
        name: row["Account Name"] || row["name"] || "",
        category: row["Category"] || row["category"] || "",
        openingDebit: parseFloat(row["Opening Debit"] || 0) || 0,
        openingCredit: parseFloat(row["Opening Credit"] || 0) || 0,
      }))

      // Send parsed rows to backend — adjust endpoint to match your actual API
      const response = await fetch(`${API_BASE_URL}/ledgers/import-accounts`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ accounts: parsedAccounts }),
      })
      const result = await response.json()

      if (result.success) {
        alert(`Imported ${parsedAccounts.length} accounts successfully.`)
        calculateTrialBalance()
      } else {
        alert("Import failed. Please check the file format and try again.")
      }
    } catch (error) {
      alert(`Failed to import file: ${error.message}`)
    } finally {
      setImporting(false)
      e.target.value = ""
    }
  }

  return (
    <div className="min-h-screen p-6 bg-gradient-to-br from-gray-50 via-slate-50 to-zinc-50">
      {/* Hidden file input for Excel import */}
      <input
        ref={importInputRef}
        type="file"
        accept=".xlsx,.xls,.csv"
        style={{ display: "none" }}
        onChange={handleImportFileChange}
      />

      <div className="max-w-[1400px] mx-auto bg-white shadow-lg rounded-lg overflow-hidden print-container">
        
        {/* Header */}
        <div className="p-6 border-b bg-gradient-to-r from-blue-100 to-blue-200">
          <div className="flex items-start justify-between gap-4 mb-4 no-print">
            <Button
              variant="outline"
              onClick={calculateTrialBalance}
              disabled={loading}
              className="flex items-center gap-2 bg-transparent"
            >
              <RefreshCw className={`h-4 w-4 ${loading ? "animate-spin" : ""}`} />
              Refresh Data
            </Button>
            <Button
              variant="outline"
              onClick={handleImportClick}
              disabled={importing}
              className="flex items-center gap-2 bg-transparent"
            >
              <Upload className="h-4 w-4" />
              {importing ? "Importing..." : "Import Excel"}
            </Button>
          </div>

          <div className="text-center mb-4 print-header">
            <h1 className="text-3xl font-bold text-gray-800">demo</h1>
            <h2 className="text-2xl font-semibold text-blue-600 mt-2">TRIAL BALANCE</h2>
            <p className="text-sm text-gray-600 mt-2">(Integrated with General Ledger)</p>
          </div>

          <div className="flex items-center justify-center gap-4 flex-wrap no-print">
            <div className="flex items-center gap-2">
              <Label className="text-sm font-medium text-gray-700">Period From:</Label>
              <Input
                type="date"
                value={startDate}
                onChange={(e) => setStartDate(e.target.value)}
                className="w-40 bg-white border-2 border-gray-300 focus:border-blue-500"
              />
            </div>
            <div className="flex items-center gap-2">
              <Label className="text-sm font-medium text-gray-700">To:</Label>
              <Input
                type="date"
                value={endDate}
                onChange={(e) => setEndDate(e.target.value)}
                className="w-40 bg-white border-2 border-gray-300 focus:border-blue-500"
              />
            </div>
            <Button
              onClick={calculateTrialBalance}
              disabled={loading}
              className="bg-blue-600 hover:bg-blue-700 text-white"
            >
              <RefreshCw className={`h-4 w-4 mr-2 ${loading ? "animate-spin" : ""}`} />
              Calculate
            </Button>
          </div>

          <div className="text-center mt-3 text-gray-700 text-sm print-period">
            Period: {formatDate(startDate)} → {formatDate(endDate)}
          </div>

          <div className="text-center mt-1 text-gray-600 text-xs no-print">
            {filteredData.length} active accounts
          </div>
        </div>

        {/* Error Messages */}
        {error && (
          <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-3 m-4 rounded no-print">
            {error}
          </div>
        )}

        {/* Search and Actions Bar */}
        <div className="p-4 bg-gray-50 border-b flex items-center justify-between gap-4 no-print">
          <div className="flex items-center bg-white border rounded-md px-3 py-2 gap-2 shadow-sm flex-1 max-w-md">
            <Search size={16} className="text-gray-400" />
            <input
              className="outline-none text-sm w-full"
              placeholder="Search account code, name or category..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
            />
          </div>
          <div className="flex items-center gap-3">
            <Button
              onClick={handleImportClick}
              variant="outline"
              disabled={importing}
              className="flex items-center gap-2 bg-transparent"
            >
              <Upload size={16} /> {importing ? "Importing..." : "Import Excel"}
            </Button>
            <Button
              onClick={handleExcelExport}
              variant="outline"
              disabled={filteredData.length === 0}
              className="flex items-center gap-2 bg-transparent"
            >
              <Download size={16} /> Export Excel
            </Button>
            <Button
              onClick={() => window.print()}
              variant="outline"
              disabled={filteredData.length === 0}
              className="flex items-center gap-2"
            >
              <Printer size={16} /> Print
            </Button>
          </div>
        </div>

        {/* Loading State */}
        {loading && (
          <div className="text-center py-12 no-print">
            <RefreshCw className="w-8 h-8 animate-spin mx-auto text-blue-600 mb-3" />
            <p className="text-gray-600">Calculating trial balance from ledger data...</p>
          </div>
        )}

        {/* Table */}
        {!loading && (
          <div className="overflow-auto">
            <table className="min-w-full table-auto border-collapse print-table">
              <thead className="sticky top-0 bg-gradient-to-r from-blue-100 to-blue-200">
                <tr>
                  <th className="text-left px-4 py-3 border border-gray-300 font-semibold text-gray-700">
                    Account Code
                  </th>
                  <th className="text-left px-4 py-3 border border-gray-300 font-semibold text-gray-700">
                    Account Name
                  </th>
                  <th className="text-left px-4 py-3 border border-gray-300 font-semibold text-gray-700">
                    Category
                  </th>
                  <th className="px-4 py-3 border border-gray-300 text-right font-semibold text-green-600">
                    Current<br />Debit
                  </th>
                  <th className="px-4 py-3 border border-gray-300 text-right font-semibold text-red-600">
                    Current<br />Credit
                  </th>
                  <th className="px-4 py-3 border border-gray-300 text-right font-semibold text-green-600">
                    Closing<br />Debit
                  </th>
                  <th className="px-4 py-3 border border-gray-300 text-right font-semibold text-red-600">
                    Closing<br />Credit
                  </th>
                </tr>
              </thead>
              <tbody>
                {filteredData.length > 0 ? (
                  filteredData.map((row, i) => (
                    <tr
                      key={`${row.code}-${i}`}
                      className={`${i % 2 === 0 ? "bg-white" : "bg-gray-50"} hover:bg-blue-50 transition-colors`}
                    >
                      <td className="px-4 py-3 text-sm text-gray-700 border border-gray-300 font-mono">
                        {row.code}
                      </td>
                      <td className="px-4 py-3 text-sm text-gray-700 border border-gray-300">
                        {row.name}
                      </td>
                      <td className="px-4 py-3 text-sm text-gray-700 border border-gray-300">
                        <span className="inline-block bg-blue-100 text-blue-800 px-2 py-1 rounded text-xs font-medium">
                          {row.category}
                        </span>
                      </td>
                      <td className="px-4 py-3 text-sm text-right border border-gray-300 font-mono">
                        {row.currentDebit > 0 ? (
                          <span className="text-green-600 font-semibold">{format(row.currentDebit)}</span>
                        ) : (
                          <span className="text-gray-400">-</span>
                        )}
                      </td>
                      <td className="px-4 py-3 text-sm text-right border border-gray-300 font-mono">
                        {row.currentCredit > 0 ? (
                          <span className="text-red-600 font-semibold">{format(row.currentCredit)}</span>
                        ) : (
                          <span className="text-gray-400">-</span>
                        )}
                      </td>
                      <td className="px-4 py-3 text-sm text-right border border-gray-300 font-mono">
                        {row.closingDebit > 0 ? (
                          <span className="text-green-600 font-bold">{format(row.closingDebit)}</span>
                        ) : (
                          <span className="text-gray-400">-</span>
                        )}
                      </td>
                      <td className="px-4 py-3 text-sm text-right border border-gray-300 font-mono">
                        {row.closingCredit > 0 ? (
                          <span className="text-red-600 font-bold">{format(row.closingCredit)}</span>
                        ) : (
                          <span className="text-gray-400">-</span>
                        )}
                      </td>
                    </tr>
                  ))
                ) : (
                  <tr>
                    <td colSpan="9" className="px-4 py-12 text-center text-gray-500 border border-gray-300">
                      <div className="text-lg mb-2">
                        {searchTerm
                          ? "No accounts found matching your search"
                          : "No accounts with activity in this period"}
                      </div>
                    </td>
                  </tr>
                )}

                {/* Totals Row */}
                {filteredData.length > 0 && (
                  <tr className="bg-gradient-to-r from-gray-100 to-gray-200 font-bold border-t-2 border-gray-400">
                    <td className="px-4 py-4 text-sm border border-gray-300" colSpan="3">
                      <span className="text-lg">TOTAL</span>
                    </td>
                 <td className="px-4 py-4 text-sm text-right border border-gray-300 font-mono text-green-700 text-lg">
                      {format(totals.currentDebit)}
                    </td>
                    <td className="px-4 py-4 text-sm text-right border border-gray-300 font-mono text-red-700 text-lg">
                      {format(totals.currentCredit)}
                    </td>
                    <td className="px-4 py-4 text-sm text-right border border-gray-300 font-mono text-green-700 text-lg">
                      {format(totals.closingDebit)}
                    </td>
                    <td className="px-4 py-4 text-sm text-right border border-gray-300 font-mono text-red-700 text-lg">
                      {format(totals.closingCredit)}
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        )}

        {/* Footer Info */}
        {!loading && filteredData.length > 0 && (
          <div className="p-4 text-xs border-t bg-gray-50">
            <div className="flex justify-between items-center flex-wrap gap-2">
              <span className="text-gray-600">
                * All amounts are calculated from General Ledger entries
              </span>
              <div className="font-medium text-gray-700">
                <span className="mr-4">
                  Opening Difference: {format(Math.abs(totals.openingDebit - totals.openingCredit))}
                </span>
                <span className="mr-4">
                  Current Difference: {format(Math.abs(totals.currentDebit - totals.currentCredit))}
                </span>
                <span>
                  Closing Difference: {format(Math.abs(totals.closingDebit - totals.closingCredit))}
                </span>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  )
}
