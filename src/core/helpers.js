"use strict";
const $ = (s) => document.querySelector(s),
  $$ = (s) => Array.from(document.querySelectorAll(s));
const esc = (s) =>
  String(s ?? "").replace(
    /[&<>"']/g,
    (c) =>
      ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[
        c
      ],
  );
const money = (n) => "$" + Number(n).toFixed(2);
const roundMoney = (n) => Math.round((n + Number.EPSILON) * 100) / 100;
const roundPackagePrice = (price) => Math.round(price * 10) / 10;
const num = (n) => Number(n) || 0;
const key = (s) => String(s).trim().toLowerCase();
const uid = () => crypto.randomUUID?.() || String(Date.now()) + Math.random();
const fmt = (d) => {
  let x = new Date(d);
  return `${x.getFullYear()}-${String(x.getMonth() + 1).padStart(2, "0")}-${String(x.getDate()).padStart(2, "0")}`;
};
const parseDate = (s) => new Date(s + "T12:00:00");
const addDays = (d, n) => {
  let x = new Date(d);
  x.setDate(x.getDate() + n);
  return x;
};
const monday = (d) => {
  let x = new Date(d);
  x.setDate(x.getDate() - ((x.getDay() + 6) % 7));
  return x;
};
const weekKey = (d) => fmt(monday(d));
