// API del dashboard de analíticas (Centro de Administración). Lee los agregados que
// calcula el server desde la colección analytics_events (búsquedas + pageviews).
import { baseApi } from "./baseApi";

export interface TopSearch {
  query: string;
  count: number;
  results: number; // resultados de su búsqueda más reciente
}

export interface ZeroResultSearch {
  query: string;
  count: number;
}

export interface ProductCount {
  productId: string;
  clicks?: number; // topClickedProducts (CTR)
  views?: number; // trafficByProduct (visitas a la ficha)
}

export interface DayPoint {
  day: string; // "AAAA-MM-DD"
  visits: number;
  searches: number;
}

export interface SessionAction {
  type: 'pageview' | 'search';
  timestamp: string;
  page?: string;
  query?: string;
  resultsCount?: number;
  clickedProductId?: string | null;
}

export interface SessionLog {
  id: string;
  userAgent: string;
  startTime: string;
  isNewVisitor?: boolean;
  entryType?: string;
  referrer?: string;
  utmSource?: string;
  utmMedium?: string;
  utmCampaign?: string;
  actions: SessionAction[];
}

export interface RawSearch {
  id: string;
  query: string;
  resultsCount: number;
  clickedProductId: string | null;
  timestamp: string;
  ip: string;
  deviceType: string;
}

export interface SearchAnalytics {
  range: { days: number };
  totals: {
    events: number;
    searches: number;
    pageviews: number;
    uniqueTerms: number;
    zeroResultTerms: number;
    capped: boolean; // true si se alcanzó el tope de lectura (hay más datos)
  };
  timeseries: DayPoint[];
  topSearches: TopSearch[];
  zeroResultSearches: ZeroResultSearch[];
  topClickedProducts: ProductCount[];
  trafficByProduct: ProductCount[];
}

export const searchAnalyticsApi = baseApi.injectEndpoints({
  endpoints: (build) => ({
    getSearchAnalytics: build.query<SearchAnalytics, { days?: number } | void>({
      query: (arg) => `/search-events/analytics?days=${(arg && arg.days) || 30}`,
      providesTags: ["SearchAnalytics"],
    }),
    getSearchSessions: build.query<{ ok: boolean; sessions: SessionLog[] }, { days?: number } | void>({
      query: (arg) => `/search-events/sessions?days=${(arg && arg.days) || 30}`,
      providesTags: ["SearchAnalytics"],
    }),
    getRawSearches: build.query<{ ok: boolean; searches: RawSearch[] }, { days?: number } | void>({
      query: (arg) => `/search-events/raw-searches?days=${(arg && arg.days) || 30}`,
      providesTags: ["SearchAnalytics"],
    }),
  }),
});

export const { useGetSearchAnalyticsQuery, useGetSearchSessionsQuery, useGetRawSearchesQuery } = searchAnalyticsApi;
