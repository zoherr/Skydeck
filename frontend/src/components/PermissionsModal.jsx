import React, { useState, useEffect } from 'react';
import { ShieldCheck, X } from 'lucide-react';

export default function PermissionsModal({ isOpen, file, onClose, onApply }) {
  const [octal, setOctal] = useState('0644');
  const [matrix, setMatrix] = useState({
    user: { r: true, w: true, x: false },
    group: { r: true, w: false, x: false },
    other: { r: true, w: false, x: false },
  });

  useEffect(() => {
    if (file && file.octal_mode) {
      let code = file.octal_mode;
      if (code.length === 3) code = '0' + code;
      setOctal(code);
      updateMatrixFromOctal(code);
    }
  }, [file]);

  const updateMatrixFromOctal = (octalStr) => {
    const clean = octalStr.slice(-3);
    if (clean.length !== 3) return;

    const parseDigit = (d) => {
      const val = parseInt(d, 8) || 0;
      return {
        r: (val & 4) !== 0,
        w: (val & 2) !== 0,
        x: (val & 1) !== 0,
      };
    };

    setMatrix({
      user: parseDigit(clean[0]),
      group: parseDigit(clean[1]),
      other: parseDigit(clean[2]),
    });
  };

  const calculateOctalFromMatrix = (m) => {
    const digitVal = (perm) => (perm.r ? 4 : 0) + (perm.w ? 2 : 0) + (perm.x ? 1 : 0);
    const u = digitVal(m.user);
    const g = digitVal(m.group);
    const o = digitVal(m.other);
    return `0${u}${g}${o}`;
  };

  const handleCheckboxChange = (scope, perm) => {
    const updated = {
      ...matrix,
      [scope]: {
        ...matrix[scope],
        [perm]: !matrix[scope][perm],
      },
    };
    setMatrix(updated);
    setOctal(calculateOctalFromMatrix(updated));
  };

  const handleOctalInputChange = (e) => {
    const val = e.target.value;
    setOctal(val);
    if (/^0?[0-7]{3}$/.test(val)) {
      updateMatrixFromOctal(val);
    }
  };

  if (!isOpen || !file) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 backdrop-blur-sm animate-in fade-in duration-150">
      <div className="bg-surface border border-border rounded-card w-full max-w-md p-6 shadow-2xl relative">
        <button
          onClick={onClose}
          className="absolute top-4 right-4 text-textMuted hover:text-textPrimary transition-hover"
        >
          <X className="w-4 h-4" />
        </button>

        <div className="flex items-center gap-3 mb-4">
          <div className="p-2 rounded-card bg-accent/10 text-accent">
            <ShieldCheck className="w-5 h-5" />
          </div>
          <div>
            <h3 className="text-base font-semibold text-textPrimary">Permissions Editor</h3>
            <p className="text-xs text-textMuted truncate max-w-xs">{file.name}</p>
          </div>
        </div>

        {/* Matrix */}
        <div className="bg-surface-2 border border-border/50 rounded-card p-4 mb-4">
          <div className="grid grid-cols-4 gap-2 text-center text-xs font-medium text-textMuted mb-2 border-b border-border/40 pb-2">
            <span className="text-left pl-2">Role</span>
            <span>Read (r)</span>
            <span>Write (w)</span>
            <span>Exec (x)</span>
          </div>

          {[
            { key: 'user', label: 'Owner (User)' },
            { key: 'group', label: 'Group' },
            { key: 'other', label: 'Others' },
          ].map((role) => (
            <div key={role.key} className="grid grid-cols-4 gap-2 text-center items-center py-1.5 text-xs">
              <span className="text-left pl-2 font-medium text-textPrimary">{role.label}</span>
              <input
                type="checkbox"
                checked={matrix[role.key].r}
                onChange={() => handleCheckboxChange(role.key, 'r')}
                className="w-4 h-4 mx-auto accent-accent cursor-pointer rounded"
              />
              <input
                type="checkbox"
                checked={matrix[role.key].w}
                onChange={() => handleCheckboxChange(role.key, 'w')}
                className="w-4 h-4 mx-auto accent-accent cursor-pointer rounded"
              />
              <input
                type="checkbox"
                checked={matrix[role.key].x}
                onChange={() => handleCheckboxChange(role.key, 'x')}
                className="w-4 h-4 mx-auto accent-accent cursor-pointer rounded"
              />
            </div>
          ))}
        </div>

        {/* Octal input */}
        <div className="flex items-center justify-between mb-6">
          <label className="text-xs font-medium text-textMuted">Octal Notation:</label>
          <input
            type="text"
            value={octal}
            onChange={handleOctalInputChange}
            maxLength={4}
            className="w-24 bg-surface-2 border border-border px-3 py-1.5 text-center text-sm font-mono text-textPrimary rounded-input focus:outline-none focus:border-accent"
          />
        </div>

        {/* Actions */}
        <div className="flex justify-end gap-3">
          <button
            onClick={onClose}
            className="px-4 py-2 text-xs font-medium text-textMuted hover:text-textPrimary bg-surface-2 hover:bg-border/50 rounded-btn transition-hover"
          >
            Cancel
          </button>
          <button
            onClick={() => onApply(file.path, octal)}
            className="px-4 py-2 text-xs font-medium text-white bg-accent hover:bg-accent-hover rounded-btn transition-hover"
          >
            Apply Permissions
          </button>
        </div>
      </div>
    </div>
  );
}
