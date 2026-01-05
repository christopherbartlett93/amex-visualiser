import React, { useState } from 'react';
import { Upload, DollarSign, TrendingUp, ChevronDown, ChevronRight } from 'lucide-react';
import Papa from 'papaparse';

const TransactionAnalyzer = () => {
  const [exactTotals, setExactTotals] = useState([]);
  const [groupedTotals, setGroupedTotals] = useState([]);
  const [categoryDetails, setCategoryDetails] = useState({});
  const [overallTotal, setOverallTotal] = useState(0);
  const [isProcessing, setIsProcessing] = useState(false);
  const [expandedCategories, setExpandedCategories] = useState({});

  const merchantGroups = {
    'AMAZON': ['AMAZON', 'AMZN'],
    'PAYPAL': ['PAYPAL'],
    'SUBSCRIPTIONS': ['NETFLIX', 'AUDIBLE'],
    'GOOGLE': ['GOOGLE']
  };

  const subcategoryGroups = {
    'GROCERY': {
      'Tesco': ['TESCO'],
      'Sainsburys': ['SAINSBURY'],
      'Asda': ['ASDA'],
      'Lidl': ['LIDL'],
      'Aldi': ['ALDI'],
      'Morrisons': ['MORRISONS', 'MORRISON'],
      'Waitrose': ['WAITROSE'],
      'Marks & Spencer': ['M&S', 'MARKS & SPENCER', 'MARKS AND SPENCER'],
      'Co-op': ['CO-OP', 'COOP', 'CO OP'],
      'Costco': ['COSTCO'],
      'Iceland': ['ICELAND']
    },
    'UTILITIES': {
      'Energy': ['OCTOPUS', 'BRITISH GAS', 'EON', 'EDF', 'BULB', 'OVO'],
      'Internet': ['BT', 'VIRGIN MEDIA', 'SKY', 'TALKTALK', 'PLUSNET'],
      'Water': ['THAMES WATER', 'SEVERN TRENT', 'UNITED UTILITIES', 'YORKSHIRE WATER']
    }
  };

  const excludedKeywords = ['PAYMENT RECEIVED', 'THANK YOU'];

  const isExcludedMerchant = (merchantName) => {
    const upper = merchantName.toUpperCase();
    return excludedKeywords.some(keyword => upper.includes(keyword));
  };

  const findMerchantGroup = (merchantName) => {
    const upper = merchantName.toUpperCase();
    
    // Check subcategory groups first
    for (const [mainCategory, subcategories] of Object.entries(subcategoryGroups)) {
      for (const [subCategory, keywords] of Object.entries(subcategories)) {
        if (keywords.some(keyword => upper.includes(keyword))) {
          return { main: mainCategory, sub: subCategory };
        }
      }
    }
    
    // Check regular merchant groups
    for (const [group, keywords] of Object.entries(merchantGroups)) {
      if (keywords.some(keyword => upper.includes(keyword))) {
        return { main: group, sub: null };
      }
    }
    
    return null;
  };

  const handleFileUpload = (event) => {
    const file = event.target.files[0];
    if (!file) return;

    setIsProcessing(true);

    Papa.parse(file, {
      header: true,
      skipEmptyLines: true,
      complete: (results) => {
        processTransactions(results.data);
        setIsProcessing(false);
      },
      error: (error) => {
        console.error('Error parsing CSV:', error);
        setIsProcessing(false);
      }
    });
  };

  const processTransactions = (data) => {
    const exactMap = {};
    const groupedMap = {};
    const detailsMap = {};

    data.forEach(row => {
      const merchant = row['Appears On Your Statement As'];
      const amountStr = row['Amount'];

      if (!merchant || !amountStr) return;

      const amount = parseFloat(amountStr.replace(/[£$,]/g, '').trim());
      if (isNaN(amount)) return;

      // Exact totals
      exactMap[merchant] = (exactMap[merchant] || 0) + amount;

      // Skip excluded merchants
      if (isExcludedMerchant(merchant)) return;

      // Find group
      const groupResult = findMerchantGroup(merchant);
      
      if (groupResult === null) {
        // MISCELLANEOUS
        const mainKey = 'MISCELLANEOUS';
        groupedMap[mainKey] = (groupedMap[mainKey] || 0) + amount;
        
        if (!detailsMap[mainKey]) {
          detailsMap[mainKey] = {};
        }
        detailsMap[mainKey][merchant] = (detailsMap[mainKey][merchant] || 0) + amount;
      } else {
        const { main, sub } = groupResult;
        groupedMap[main] = (groupedMap[main] || 0) + amount;
        
        if (!detailsMap[main]) {
          detailsMap[main] = {};
        }
        
        if (sub) {
          // Has subcategory
          if (!detailsMap[main][sub]) {
            detailsMap[main][sub] = { total: 0, merchants: {} };
          }
          detailsMap[main][sub].total += amount;
          detailsMap[main][sub].merchants[merchant] = (detailsMap[main][sub].merchants[merchant] || 0) + amount;
        } else {
          // No subcategory, just track merchant
          detailsMap[main][merchant] = (detailsMap[main][merchant] || 0) + amount;
        }
      }
    });

    // Convert to sorted arrays
    const exactArray = Object.entries(exactMap)
      .map(([name, total]) => ({ name, total }))
      .sort((a, b) => a.name.localeCompare(b.name));

    const groupedArray = Object.entries(groupedMap)
      .map(([name, total]) => ({ name, total }))
      .sort((a, b) => a.name.localeCompare(b.name));

    const total = groupedArray.reduce((sum, item) => sum + item.total, 0);

    setExactTotals(exactArray);
    setGroupedTotals(groupedArray);
    setCategoryDetails(detailsMap);
    setOverallTotal(total);
  };

  const toggleCategory = (categoryName) => {
    setExpandedCategories(prev => ({
      ...prev,
      [categoryName]: !prev[categoryName]
    }));
  };

  const formatCurrency = (amount) => {
    return new Intl.NumberFormat('en-GB', {
      style: 'currency',
      currency: 'GBP'
    }).format(amount);
  };

  const renderCategoryDetails = (categoryName) => {
    const details = categoryDetails[categoryName];
    if (!details) return null;

    const hasSubcategories = Object.values(details).some(val => typeof val === 'object' && val.total !== undefined);

    if (hasSubcategories) {
      // Has subcategories (like GROCERY or UTILITIES)
      return (
        <div className="ml-8 mt-2 space-y-2">
          {Object.entries(details).map(([subName, subData]) => (
            <div key={subName}>
              <div className="flex justify-between items-center p-3 bg-white/5 rounded">
                <span className="text-purple-200 font-medium">• {subName}</span>
                <span className="text-purple-300 font-semibold">{formatCurrency(subData.total)}</span>
              </div>
              {/* Show individual merchants under subcategory */}
              <div className="ml-6 mt-1 space-y-1">
                {Object.entries(subData.merchants).map(([merchant, amount]) => (
                  <div key={merchant} className="flex justify-between items-center p-2 bg-white/5 rounded text-sm">
                    <span className="text-purple-100 text-xs">→ {merchant}</span>
                    <span className="text-purple-200 text-xs">{formatCurrency(amount)}</span>
                  </div>
                ))}
              </div>
            </div>
          ))}
        </div>
      );
    } else {
      // No subcategories (like AMAZON, MISCELLANEOUS)
      return (
        <div className="ml-8 mt-2 space-y-2">
          {Object.entries(details).map(([merchant, amount]) => (
            <div key={merchant} className="flex justify-between items-center p-2 bg-white/5 rounded text-sm">
              <span className="text-purple-200">• {merchant}</span>
              <span className="text-purple-300">{formatCurrency(amount)}</span>
            </div>
          ))}
        </div>
      );
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-900 via-purple-900 to-slate-900 p-8">
      <div className="max-w-6xl mx-auto">
        <div className="text-center mb-8">
          <h1 className="text-4xl font-bold text-white mb-2">Transaction Analyzer</h1>
          <p className="text-purple-200">Upload your CSV to analyze spending patterns</p>
        </div>

        {/* Upload Section */}
        <div className="bg-white/10 backdrop-blur-lg rounded-2xl p-8 mb-8 border border-white/20">
          <label className="flex flex-col items-center justify-center cursor-pointer">
            <Upload className="w-16 h-16 text-purple-300 mb-4" />
            <span className="text-xl text-white mb-2">Upload CSV File</span>
            <span className="text-sm text-purple-200">Click to browse or drag and drop</span>
            <input
              type="file"
              accept=".csv"
              onChange={handleFileUpload}
              className="hidden"
            />
          </label>
          {isProcessing && (
            <p className="text-center text-purple-300 mt-4">Processing...</p>
          )}
        </div>

        {groupedTotals.length > 0 && (
          <>
            {/* Overall Total */}
            <div className="bg-gradient-to-r from-purple-600 to-pink-600 rounded-2xl p-8 mb-8 shadow-2xl">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-purple-100 text-sm uppercase tracking-wide mb-1">Total Spending</p>
                  <p className="text-5xl font-bold text-white">{formatCurrency(overallTotal)}</p>
                  <p className="text-purple-100 text-sm mt-2">Excluding payments received</p>
                </div>
                <DollarSign className="w-20 h-20 text-white/30" />
              </div>
            </div>

            {/* Grouped Totals with Dropdowns */}
            <div className="bg-white/10 backdrop-blur-lg rounded-2xl p-8 mb-8 border border-white/20">
              <div className="flex items-center mb-6">
                <TrendingUp className="w-6 h-6 text-purple-300 mr-2" />
                <h2 className="text-2xl font-bold text-white">Category Breakdown</h2>
              </div>
              <div className="space-y-4">
                {groupedTotals.map((item, index) => (
                  <div key={index}>
                    <div 
                      className="flex justify-between items-center p-4 bg-white/5 rounded-lg hover:bg-white/10 transition-colors cursor-pointer"
                      onClick={() => toggleCategory(item.name)}
                    >
                      <div className="flex items-center">
                        {expandedCategories[item.name] ? (
                          <ChevronDown className="w-5 h-5 text-purple-300 mr-2" />
                        ) : (
                          <ChevronRight className="w-5 h-5 text-purple-300 mr-2" />
                        )}
                        <span className="text-white font-semibold text-lg">{item.name}</span>
                      </div>
                      <span className="text-purple-300 font-bold text-lg">{formatCurrency(item.total)}</span>
                    </div>
                    
                    {/* Expanded Details */}
                    {expandedCategories[item.name] && renderCategoryDetails(item.name)}
                  </div>
                ))}
              </div>
            </div>

            {/* Exact Totals */}
            <div className="bg-white/10 backdrop-blur-lg rounded-2xl p-8 border border-white/20">
              <h2 className="text-2xl font-bold text-white mb-6">All Transactions</h2>
              <div className="max-h-96 overflow-y-auto space-y-2">
                {exactTotals.map((item, index) => (
                  <div key={index} className="flex justify-between items-center p-3 bg-white/5 rounded hover:bg-white/10 transition-colors">
                    <span className="text-purple-100 text-sm">{item.name}</span>
                    <span className="text-purple-300 font-semibold">{formatCurrency(item.total)}</span>
                  </div>
                ))}
              </div>
            </div>
          </>
        )}
      </div>
    </div>
  );
};

export default TransactionAnalyzer;