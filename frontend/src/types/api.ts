export interface ApiSuccessResponse<T> {
  status: 'success';
  data: T;
}

export interface ApiErrorResponse {
  status: 'error';
  error: {
    code: string;
    message: string;
  };
}

export type ApiResponse<T> = ApiSuccessResponse<T> | ApiErrorResponse;

export type ApiState = 'idle' | 'loading' | 'success' | 'empty' | 'error';
