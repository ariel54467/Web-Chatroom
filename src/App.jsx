import { Routes, Route } from 'react-router-dom';
import { SignIn } from './display/SignIn';
import { Home } from './display/Home';
import { SignUp } from './display/SignUp';
import { Chat } from './display/Chat';
import { Context } from './comp/Context';

function App() {
  

  return (
    <Context>
      <Routes>
        <Route path='/' element = {<Home/>} />
        <Route path='/signin' element={<SignIn />} />
        <Route path='/signup' element={<SignUp />} />
        <Route path='/chat' element={<Chat />} />
      </Routes>
      </Context>
  )
}

export default App
