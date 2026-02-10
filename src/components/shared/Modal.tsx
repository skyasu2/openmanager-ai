'use client';

import { X } from 'lucide-react';
import { type FC, Fragment, type ReactNode } from 'react';

interface ModalProps {
  isOpen: boolean;
  onClose: () => void;
  title: string;
  children: ReactNode;
}

export const Modal: FC<ModalProps> = ({ isOpen, onClose, title, children }) => {
  return (
    <Fragment>
      {isOpen && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/75 backdrop-blur-sm"
          role="presentation"
        >
          <button
            type="button"
            aria-label="모달 닫기"
            className="absolute inset-0 h-full w-full cursor-pointer"
            onClick={onClose}
          />
          <div
            className="relative w-full max-w-2xl rounded-xl border border-slate-700 bg-slate-800 shadow-2xl"
            role="dialog"
            aria-modal="true"
            tabIndex={-1}
          >
            <div className="flex items-center justify-between border-b border-slate-700 p-4">
              <h3 className="text-lg font-semibold text-white">{title}</h3>
              <button
                type="button"
                onClick={onClose}
                className="rounded-full p-1 text-slate-400 transition-colors hover:text-white"
                aria-label="Close modal"
              >
                <X className="h-5 w-5" />
              </button>
            </div>
            {children}
          </div>
        </div>
      )}
    </Fragment>
  );
};
