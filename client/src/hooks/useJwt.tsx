import { useCookies } from 'react-cookie';

export default function useJwt() {
  const [cookies, setCookies] = useCookies(['token']);
  const jwt = cookies.token;
  console.log('jwt in useJwt: ', jwt);
  return {
    jwt,
    setJwt: (jwt: string) => {
      console.log('setting jwt: ', jwt);
      setCookies('token', jwt, { path: '/' });
    },
    removeJwt: () => {
      setCookies('token', '', { path: '/' });
    },
  };
}
