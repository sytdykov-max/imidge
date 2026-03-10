"use client";

type SortOption = {
  value: string;
  label: string;
};

type CatalogSortSelectAutoProps = {
  name: string;
  defaultValue: string;
  className?: string;
  ariaLabel?: string;
  options: readonly SortOption[];
};

export function CatalogSortSelectAuto({
  name,
  defaultValue,
  className,
  ariaLabel,
  options,
}: CatalogSortSelectAutoProps) {
  return (
    <select
      name={name}
      defaultValue={defaultValue}
      className={className}
      aria-label={ariaLabel}
      onChange={(event) => event.currentTarget.form?.requestSubmit()}
    >
      {options.map((option) => (
        <option key={option.value} value={option.value}>
          {option.label}
        </option>
      ))}
    </select>
  );
}
