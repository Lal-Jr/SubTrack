import Dexie, { Table } from 'dexie';

export interface Transaction {
  id: string;
  date: string;
  description: string;
  amount: number;
  category: string;
  account?: string;
}

export interface Category {
  id: string;
  name: string;
}

export interface Rule {
  id: string;
  keyword: string;
  category: string;
}

export interface Subscription {
  id: string;
  name: string;
  avgAmount: number;
  nextRenewal: string;
  lastCharged: string;
  active: boolean;
  confidence?: number;
}

export interface ForecastSnapshot {
  id: string;
  date: string;
  balance: number;
}

export class SubtrackDB extends Dexie {
  transactions!: Table<Transaction, string>;
  categories!: Table<Category, string>;
  rules!: Table<Rule, string>;
  subscriptions!: Table<Subscription, string>;
  forecast_snapshots!: Table<ForecastSnapshot, string>;

  constructor() {
    super('SubtrackDB');
    this.version(1).stores({
      transactions: 'id, date, category, description',
      categories: 'id, name',
      rules: 'id, keyword, category',
      subscriptions: 'id, name, nextRenewal, lastCharged, active',
      forecast_snapshots: 'id, date',
    });
  }
}

const db = new SubtrackDB();
export default db;
