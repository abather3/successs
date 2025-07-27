import { setupProvider } from './pact-setup';
import { Matchers } from '@pact-foundation/pact';
import { server } from '@/server'; // assume server is exported from backend src/index or a server setup file

const { eachLike, like } = Matchers;

describe('Provider tests for Authentication API', () = {
  const provider = setupProvider({ providerName: 'EscaShopBackend' });

  beforeAll(async () = {
    server.listen(1234);
  });

  afterAll(async () = {
    server.close();
  });

  describe('validating the expectations of FrontendClient', () = {
    beforeAll(async () = {
      await provider.setup();
      await provider.addInteraction({
        uponReceiving: 'a request for user login',
        withRequest: {
          method: 'POST',
          path: '/api/auth/login',
          headers: {
            'Content-Type': 'application/json'
          },
          body: {
            email: like('user@example.com'),
            password: like('password123')
          }
        },
        willRespondWith: {
          status: 200,
          headers: {
            'Content-Type': 'application/json'
          },
          body: {
            user: like({
              id: 1,
              email: 'user@example.com',
              full_name: 'John Doe',
              role: 'cashier',
              status: 'active'
            }),
            accessToken: like('jwt.access.token'),
            refreshToken: like('jwt.refresh.token')
          }
        }
      });
    });

    afterEach(async () = {
      await provider.verify();
    });

    afterAll(async () = {
      await provider.finalize();
    });

    it('returns the correct data', async () = {
      const response = await fetch('http://localhost:1234/api/auth/login', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          email: 'user@example.com',
          password: 'password123'
        })
      });
      const data = await response.json();
      expect(response.status).toBe(200);
      expect(data).toEqual({
        user: expect.objectContaining({
          id: expect.any(Number),
          email: expect.any(String),
          full_name: expect.any(String),
          role: expect.any(String),
          status: expect.any(String)
        }),
        accessToken: expect.any(String),
        refreshToken: expect.any(String)
      });
    });
  });
});
