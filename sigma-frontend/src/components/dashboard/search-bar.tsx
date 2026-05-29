"use client";

import { AnimatePresence, motion } from "framer-motion";
import { Check, ChevronDown, Search, X } from "lucide-react";
import { useTranslations } from "next-intl";
import { useEffect, useRef, useState } from "react";

import type { Category, Market } from "@/lib/types";
import { cn } from "@/lib/utils";

const categories: Category[] = ["politics", "finance", "technology", "macro"];
const markets: Market[] = ["us", "cn", "hk", "jp", "eu", "kr", "tw"];

interface CustomSelectProps {
  onChange: (value: string) => void;
  options: Array<{ label: string; value: string }>;
  placeholder: string;
  value: string;
}

function CustomSelect({ onChange, options, placeholder, value }: CustomSelectProps) {
  const [isOpen, setIsOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (ref.current && !ref.current.contains(event.target as Node)) {
        setIsOpen(false);
      }
    }
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  const selectedOption = options.find((option) => option.value === value);

  return (
    <div className="relative" ref={ref}>
      <motion.button
        className={cn(
          "flex min-w-[150px] items-center gap-2 rounded-2xl border bg-card px-4 py-3 text-sm font-bold transition-all duration-200",
          isOpen ? "border-primary shadow-sm ring-2 ring-primary/20" : "border-border hover:border-muted-foreground/40"
        )}
        onClick={() => setIsOpen((current) => !current)}
        type="button"
        whileTap={{ scale: 0.98 }}
      >
        <span className={selectedOption?.value === "" ? "text-muted-foreground" : "text-foreground"}>
          {selectedOption?.label || placeholder}
        </span>
        <motion.div animate={{ rotate: isOpen ? 180 : 0 }} className="ml-auto" transition={{ duration: 0.2 }}>
          <ChevronDown className="h-4 w-4 text-muted-foreground" />
        </motion.div>
      </motion.button>

      <AnimatePresence>
        {isOpen ? (
          <motion.div
            animate={{ opacity: 1, scale: 1, y: 0 }}
            className="absolute left-0 top-full z-50 mt-2 w-full min-w-[180px] overflow-hidden rounded-2xl border border-border bg-popover/95 shadow-sm"
            exit={{ opacity: 0, scale: 0.96, y: -8 }}
            initial={{ opacity: 0, scale: 0.96, y: -8 }}
            transition={{ duration: 0.15, ease: "easeOut" }}
          >
            <div className="p-1">
              {options.map((option, index) => (
                <motion.button
                  animate={{ opacity: 1, x: 0 }}
                  className={cn(
                    "flex w-full items-center justify-between rounded-xl px-3 py-2.5 text-left text-sm transition-colors",
                    value === option.value ? "bg-primary/10 font-bold text-primary" : "text-foreground hover:bg-muted"
                  )}
                  initial={{ opacity: 0, x: -10 }}
                  key={option.value}
                  onClick={() => {
                    onChange(option.value);
                    setIsOpen(false);
                  }}
                  transition={{ delay: index * 0.03 }}
                  type="button"
                >
                  <span>{option.label}</span>
                  {value === option.value ? <Check className="h-4 w-4 text-primary" /> : null}
                </motion.button>
              ))}
            </div>
          </motion.div>
        ) : null}
      </AnimatePresence>
    </div>
  );
}

interface SearchBarProps {
  category: Category | "";
  market: Market | "";
  query: string;
  setCategory: (value: Category | "") => void;
  setMarket: (value: Market | "") => void;
  setQuery: (value: string) => void;
}

export function SearchBar({ category, market, query, setCategory, setMarket, setQuery }: SearchBarProps) {
  const t = useTranslations("feed");
  const [isFocused, setIsFocused] = useState(false);

  return (
    <motion.div
      animate={{ opacity: 1, y: 0 }}
      className="flex flex-col gap-3 sm:flex-row"
      initial={{ opacity: 0, y: 20 }}
      transition={{ delay: 0.1 }}
    >
      <div className="relative flex-1">
        <Search
          className={cn(
            "absolute left-4 top-1/2 h-5 w-5 -translate-y-1/2 transition-colors duration-200",
            isFocused ? "text-primary" : "text-muted-foreground"
          )}
        />
        <input
          className={cn(
            "w-full rounded-2xl border bg-card py-3.5 pl-12 pr-10 text-sm text-foreground placeholder:text-muted-foreground",
            isFocused ? "border-primary shadow-sm ring-2 ring-primary/20" : "border-border hover:border-muted-foreground/40"
          )}
          onBlur={() => setIsFocused(false)}
          onChange={(event) => setQuery(event.target.value)}
          onFocus={() => setIsFocused(true)}
          placeholder={t("search")}
          type="text"
          value={query}
        />
        <AnimatePresence>
          {query ? (
            <motion.button
              animate={{ opacity: 1, scale: 1 }}
              className="absolute right-4 top-1/2 -translate-y-1/2 rounded-full p-1 transition-colors hover:bg-muted"
              exit={{ opacity: 0, scale: 0.8 }}
              initial={{ opacity: 0, scale: 0.8 }}
              onClick={() => setQuery("")}
              type="button"
            >
              <X className="h-4 w-4 text-muted-foreground" />
            </motion.button>
          ) : null}
        </AnimatePresence>
      </div>

      <div className="flex gap-3 overflow-x-auto pb-1 sm:overflow-visible sm:pb-0">
        <CustomSelect
          onChange={(value) => setCategory(value as Category | "")}
          options={[{ label: t("all"), value: "" }, ...categories.map((value) => ({ label: t(`categories.${value}`), value }))]}
          placeholder={t("categoryFilter")}
          value={category}
        />
        <CustomSelect
          onChange={(value) => setMarket(value as Market | "")}
          options={[{ label: t("all"), value: "" }, ...markets.map((value) => ({ label: t(`markets.${value}`), value }))]}
          placeholder={t("marketFilter")}
          value={market}
        />
      </div>
    </motion.div>
  );
}
