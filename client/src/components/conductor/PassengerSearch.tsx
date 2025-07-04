import React, { useState, useEffect } from 'react';
import { 
  Search, 
  Filter, 
  X, 
  Users, 
  AlertCircle,
  CheckCircle,
  Minus,
  RefreshCw
} from 'lucide-react';
import { MINISTRIES } from '../../utils/constants';
import { debounce } from '../../utils/helpers';
import type { SearchFilters } from '../../types';

interface PassengerSearchProps {
  onSearch: (filters: SearchFilters) => void;
  onClear?: () => void;
  onRefresh?: () => void;
  isLoading?: boolean;
  placeholder?: string;
  totalCount?: number;
  filteredCount?: number;
  className?: string;
}

const PassengerSearch: React.FC<PassengerSearchProps> = ({
  onSearch,
  onClear,
  onRefresh,
  isLoading = false,
  totalCount,
  filteredCount,
  className = ''
}) => {
  const [searchQuery, setSearchQuery] = useState('');
  const [balanceStatus, setBalanceStatus] = useState<SearchFilters['balance_status']>('all');
  const [selectedMinistry, setSelectedMinistry] = useState<string>('');
  const [showFilters, setShowFilters] = useState(false);

  // Debounced search function
  const debouncedSearch = React.useMemo(
    () => debounce((filters: SearchFilters) => {
      onSearch(filters);
    }, 300),
    [onSearch]
  );

  // Effect to trigger search when filters change
  useEffect(() => {
    const filters: SearchFilters = {
      query: searchQuery.trim(),
      balance_status: balanceStatus,
      ministry: selectedMinistry || undefined
    };

    debouncedSearch(filters);
  }, [searchQuery, balanceStatus, selectedMinistry, debouncedSearch]);

  const handleClearFilters = () => {
    setSearchQuery('');
    setBalanceStatus('all');
    setSelectedMinistry('');
    setShowFilters(false);
    if (onClear) {
      onClear();
    }
  };

  const hasActiveFilters = searchQuery.trim() || balanceStatus !== 'all' || selectedMinistry;

  const balanceOptions = [
    { value: 'all', label: 'All Balances', icon: <Users className="h-4 w-4" /> },
    { value: 'positive', label: 'Positive Balance', icon: <CheckCircle className="h-4 w-4 text-green-500" /> },
    { value: 'low', label: 'Low Balance', icon: <AlertCircle className="h-4 w-4 text-orange-500" /> },
    { value: 'zero', label: 'Zero Balance', icon: <Minus className="h-4 w-4 text-red-500" /> },
    { value: 'negative', label: 'Negative Balance', icon: <AlertCircle className="h-4 w-4 text-red-600" /> }
  ];

  return (
    <div className={`bg-white rounded-lg shadow-sm border border-gray-200 ${className}`}>
      {/* Main search bar */}
      <div className="p-4">
        <div className="flex items-center space-x-3">
          {/* Search input */}
          <div className="flex-1 relative">
            <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
              <Search className="h-5 w-5 text-gray-400" />
            </div>
            <input
              type="text"
              placeholder="Search by ID, name, ministry, or boarding area..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="block w-full pl-10 pr-3 py-2 border border-gray-300 rounded-md leading-5 bg-white placeholder-gray-500 focus:outline-none focus:placeholder-gray-400 focus:ring-1 focus:ring-blue-500 focus:border-blue-500"
            />
            {searchQuery && (
              <button
                onClick={() => setSearchQuery('')}
                className="absolute inset-y-0 right-0 pr-3 flex items-center"
              >
                <X className="h-4 w-4 text-gray-400 hover:text-gray-600" />
              </button>
            )}
          </div>

          {/* Filter toggle */}
          <button
            onClick={() => setShowFilters(!showFilters)}
            className={`p-2 rounded-md border transition-colors ${
              showFilters || hasActiveFilters
                ? 'bg-blue-50 border-blue-300 text-blue-600'
                : 'bg-gray-50 border-gray-300 text-gray-500 hover:bg-gray-100'
            }`}
            title="Toggle Filters"
          >
            <Filter className="h-5 w-5" />
          </button>

          {/* Refresh button */}
          {onRefresh && (
            <button
              onClick={onRefresh}
              disabled={isLoading}
              className={`p-2 rounded-md border border-gray-300 text-gray-500 hover:bg-gray-100 transition-colors ${
                isLoading ? 'opacity-50 cursor-not-allowed' : ''
              }`}
              title="Refresh"
            >
              <RefreshCw className={`h-5 w-5 ${isLoading ? 'animate-spin' : ''}`} />
            </button>
          )}
        </div>

        {/* Results summary */}
        {(totalCount !== undefined || filteredCount !== undefined) && (
          <div className="mt-3 flex items-center justify-between text-sm text-gray-600">
            <span>
              {filteredCount !== undefined && totalCount !== undefined ? (
                filteredCount === totalCount ? (
                  `Showing all ${totalCount} passengers`
                ) : (
                  `Showing ${filteredCount} of ${totalCount} passengers`
                )
              ) : totalCount !== undefined ? (
                `${totalCount} passengers`
              ) : (
                'Loading...'
              )}
            </span>

            {hasActiveFilters && (
              <button
                onClick={handleClearFilters}
                className="text-blue-600 hover:text-blue-800 font-medium"
              >
                Clear filters
              </button>
            )}
          </div>
        )}
      </div>

      {/* Extended filters */}
      {showFilters && (
        <div className="border-t border-gray-200 p-4 space-y-4">
          {/* Balance status filter */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Balance Status
            </label>
            <div className="flex flex-wrap gap-2">
              {balanceOptions.map((option) => (
                <button
                  key={option.value}
                  onClick={() => setBalanceStatus(option.value as SearchFilters['balance_status'])}
                  className={`inline-flex items-center px-3 py-2 rounded-md text-sm font-medium transition-colors ${
                    balanceStatus === option.value
                      ? 'bg-blue-100 text-blue-800 border border-blue-300'
                      : 'bg-gray-100 text-gray-700 border border-gray-300 hover:bg-gray-200'
                  }`}
                >
                  {option.icon}
                  <span className="ml-2">{option.label}</span>
                </button>
              ))}
            </div>
          </div>

          {/* Ministry filter */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Ministry
            </label>
            <select
              value={selectedMinistry}
              onChange={(e) => setSelectedMinistry(e.target.value)}
              className="block w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-1 focus:ring-blue-500 focus:border-blue-500 sm:text-sm"
            >
              <option value="">All Ministries</option>
              {MINISTRIES.map((ministry) => (
                <option key={ministry.code} value={ministry.code}>
                  {ministry.name}
                </option>
              ))}
            </select>
          </div>

          {/* Filter actions */}
          <div className="flex items-center justify-between pt-3 border-t border-gray-200">
            <span className="text-sm text-gray-500">
              {hasActiveFilters ? 'Filters applied' : 'No filters applied'}
            </span>
            <div className="flex space-x-2">
              <button
                onClick={handleClearFilters}
                className="px-3 py-1 text-sm text-gray-600 hover:text-gray-800"
              >
                Clear all
              </button>
              <button
                onClick={() => setShowFilters(false)}
                className="px-3 py-1 text-sm bg-blue-600 text-white rounded hover:bg-blue-700"
              >
                Done
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default PassengerSearch;