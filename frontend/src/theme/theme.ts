import { createTheme } from '@mui/material/styles'

export const appTheme = createTheme({
  palette: {
    mode: 'light',
    primary: { main: '#1a1a1a' },
    secondary: { main: '#424242' },
    background: {
      default: '#f5f5f5',
      paper: '#ffffff',
    },
    success: { main: '#66bb6a' },
    warning: { main: '#ffb74d' },
    error: { main: '#ef5350' },
  },
  typography: {
    fontFamily: '"Segoe UI", Roboto, "Helvetica Neue", Arial, sans-serif',
    h4: { fontWeight: 700 },
    h5: { fontWeight: 600 },
  },
  components: {
    MuiAppBar: {
      styleOverrides: {
        root: {
          backgroundColor: '#0d0d0d',
        },
      },
    },
  },
})
