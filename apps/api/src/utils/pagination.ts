export interface PaginationInput {
  page?: unknown;
  limit?: unknown;
}

export interface Pagination {
  page: number;
  limit: number;
  skip: number;
}

// clamp page/limit so clients can't request crazy values
export function getPagination(input: PaginationInput): Pagination {
  let page = Number(input.page);
  if (!Number.isFinite(page) || page < 1) {
    page = 1;
  } else {
    page = Math.floor(page);
  }

  let limit = Number(input.limit);
  if (!Number.isFinite(limit) || limit < 1) {
    limit = 20;
  } else {
    limit = Math.floor(limit);
    if (limit > 100) {
      limit = 100;
    }
  }

  return {
    page,
    limit,
    skip: (page - 1) * limit
  };
}
