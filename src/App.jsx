import { Routes, Route } from 'react-router-dom';
import { SignIn } from './display/SignIn';
import { Home } from './display/Home';
import { SignUp } from './display/SignUp';
import { Chat } from './display/Chat';

function App() {
  

  return (
      <Routes>
        <Route path='/' element = {<Home/>} />
        <Route path='/signin' element={<SignIn />} />
        <Route path='/signup' element={<SignUp />} />
        <Route path='/chat' element={<Chat />} />
      </Routes>
  )
}

export default App
