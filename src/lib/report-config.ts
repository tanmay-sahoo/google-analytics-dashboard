export const reportDetailMap = {
  "acquisition-users": {
    title: "User acquisition",
    dimension: "firstUserSourceMedium",
    metric: "newUsers"
  },
  "acquisition-sessions": {
    title: "Traffic acquisition",
    dimension: "sessionSourceMedium",
    metric: "sessions"
  },
  "top-events": {
    title: "Top events",
    dimension: "eventName",
    metric: "eventCount"
  },
  "top-pages": {
    title: "Top pages",
    dimension: "pagePath",
    metric: "screenPageViews"
  },
  "least-pages": {
    title: "Least visited pages",
    dimension: "pagePath",
    metric: "screenPageViews",
    order: "asc"
  },
  "search-terms": {
    title: "Search terms",
    dimension: "searchTerm",
    metric: "sessions"
  },
  platform: {
    title: "Platform",
    dimension: "platform",
    metric: "activeUsers"
  },
  "operating-system": {
    title: "Operating system",
    dimension: "operatingSystem",
    metric: "activeUsers"
  },
  browser: {
    title: "Browser",
    dimension: "browser",
    metric: "activeUsers"
  },
  "device-category": {
    title: "Device category",
    dimension: "deviceCategory",
    metric: "activeUsers"
  },
  "platform-device": {
    title: "Platform / device",
    dimension: "platformDeviceCategory",
    metric: "activeUsers"
  }
} as const;

export type ReportDetailKey = keyof typeof reportDetailMap;
