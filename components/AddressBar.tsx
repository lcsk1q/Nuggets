import React, { useState, useEffect, useRef } from 'react';
import { Breadcrumb } from '../types';
import { parseBreadcrumb, breadcrumbToDisplay } from '../utils/urlHelpers';

interface AddressBarProps {
  breadcrumb: Breadcrumb;
  isLoading: boolean;
  loadingMessage: string;
  onNavigate: (type: 'create' | 'edit', prompt: string) => void;
  onBack: () => void;
  onForward: () => void;
  onRefresh: () => void;
  onStop: () => void;
  onHome: () => void;
  canGoBack: boolean;
  canGoForward: boolean;
  isGrounded: boolean;
  onToggleGrounding: () => void;
}

export const AddressBar: React.FC<AddressBarProps> = ({
  breadcrumb,
  isLoading,
  loadingMessage,
  onNavigate,
  onBack,
  onForward,
  onRefresh,
  onStop,
  onHome,
  canGoBack,
  canGoForward,
  isGrounded,
  onToggleGrounding,
}) => {
  const displayText = breadcrumbToDisplay(breadcrumb);
  const [inputVal, setInputVal] = useState(displayText);
  const [isFocused, setIsFocused] = useState(false);
  const [hasEdited, setHasEdited] = useState(false);
  const [menuOpen, setMenuOpen] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);
  const menuRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!isFocused) {
      if (!hasEdited) {
        setInputVal(displayText);
      }
    }
  }, [displayText, isFocused, hasEdited]);

  // When a new generation starts (loading becomes true), clear user edits
  // so the omnibar shows "Generating..." instead of stale user text
  useEffect(() => {
    if (isLoading) {
      setHasEdited(false);
    }
  }, [isLoading]);

  // Close menu on outside click, Escape key, or iframe click (window blur)
  useEffect(() => {
    if (!menuOpen) return;
    const handleClick = (e: MouseEvent) => {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) {
        setMenuOpen(false);
      }
    };
    const handleEscape = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setMenuOpen(false);
    };
    const handleBlur = () => setMenuOpen(false);
    document.addEventListener('mousedown', handleClick);
    document.addEventListener('keydown', handleEscape);
    window.addEventListener('blur', handleBlur);
    return () => {
      document.removeEventListener('mousedown', handleClick);
      document.removeEventListener('keydown', handleEscape);
      window.removeEventListener('blur', handleBlur);
    };
  }, [menuOpen]);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const trimmed = inputVal.trim();
    if (!trimmed) return;

    const edited = parseBreadcrumb(trimmed);

    if (!edited.page && breadcrumb.page) {
      onNavigate('create', edited.sitename);
    } else if (edited.sitename !== breadcrumb.sitename) {
      onNavigate('create', trimmed);
    } else if (edited.page !== breadcrumb.page) {
      onNavigate('edit', edited.page);
    } else {
      onRefresh();
    }

    setHasEdited(false);
    inputRef.current?.blur();
  };

  const handleDomainClick = () => {
    if (breadcrumb.sitename && breadcrumb.page) {
      onNavigate('create', breadcrumb.sitename);
    }
  };

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setInputVal(e.target.value);
    setHasEdited(true);
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Escape') {
      setInputVal(displayText);
      setHasEdited(false);
      inputRef.current?.blur();
    }
  };

  const handleFocus = () => {
    setIsFocused(true);
    if (!hasEdited) {
      setInputVal(displayText.replace(/ › /g, '.'));
    }
  };

  const handleBlur = () => {
    setIsFocused(false);
    if (!hasEdited) {
      setInputVal(displayText);
    }
  };

  const displayValue = isLoading && !isFocused && !breadcrumb.page
    ? 'Generating...'
    : isFocused ? inputVal : inputVal.replace(/\./g, ' › ');

  return (
    <div className="address-bar">
      {/* Nav Buttons */}
      <div className="nav-buttons">
        <button
          onClick={onBack}
          disabled={!canGoBack}
          className={`nav-btn ${!canGoBack ? 'disabled' : ''}`}
          title="Go back"
          aria-label="Go back"
        >
          <span className="material-symbols-outlined">arrow_back</span>
        </button>
        <button
          onClick={onForward}
          disabled={!canGoForward}
          className={`nav-btn ${!canGoForward ? 'disabled' : ''}`}
          title="Go forward"
          aria-label="Go forward"
        >
          <span className="material-symbols-outlined">arrow_forward</span>
        </button>
        <button
          onClick={isLoading ? onStop : onRefresh}
          className="nav-btn"
          title={isLoading ? 'Stop loading' : 'Refresh'}
          aria-label={isLoading ? 'Stop loading' : 'Refresh'}
        >
          <span className="material-symbols-outlined">
            {isLoading ? 'close' : 'refresh'}
          </span>
        </button>
        <button onClick={onHome} className="nav-btn" title="Home" aria-label="Home">
          <span className="material-symbols-outlined">home</span>
        </button>
      </div>

      {/* Omnibar */}
      <form onSubmit={handleSubmit} className="omnibar-form">
        <div className="omnibar-wrapper">
          {isLoading && !inputVal ? (
            <div className="omnibar-loading">{loadingMessage}</div>
          ) : (
            <input
              ref={inputRef}
              type="text"
                autoComplete="off"
              value={displayValue}
              onChange={handleChange}
                onFocus={handleFocus}
                onBlur={handleBlur}
              onKeyDown={handleKeyDown}
                className="omnibar-input"
                aria-label="Address bar — enter a URL or prompt"
            />
          )}
        </div>
      </form>

      {/* 3-dots Menu */}
      <div className="menu-container" ref={menuRef}>
        <button className="nav-btn" onClick={() => setMenuOpen(!menuOpen)} title="More options" aria-label="More options" aria-haspopup="true" aria-expanded={menuOpen}>
          <span className="material-symbols-outlined">more_vert</span>
        </button>
        {menuOpen && (
          <div className="dropdown-menu" role="menu">
            <label className="dropdown-menu-item" onClick={(e) => e.stopPropagation()}>
              <span>Search Grounding</span>
              <div
                className={`toggle-track ${isGrounded ? 'active' : ''}`}
                onClick={onToggleGrounding}
                role="switch"
                aria-checked={isGrounded}
                tabIndex={0}
                onKeyDown={e => {
                  if (e.key === 'Enter' || e.key === ' ') {
                    e.preventDefault();
                    onToggleGrounding();
                  }
                }}
              >
                <div className="toggle-thumb" />
              </div>
            </label>
          </div>
        )}
      </div>
    </div>
  );
};
