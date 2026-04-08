import React from 'react'
import RegistrationPage from './pages/RegistrationPage'
import { RouterProvider } from 'react-router-dom'
import { route } from './routes/routes'

const App = () => {
  return (
    <div >
      <RouterProvider router={route}/>
    </div>
  )
}

export default App