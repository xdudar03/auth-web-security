"""
HTTP client for communicating with the Express server.

Usage:
    from mok.client.server_client import ServerClient
    
    client = ServerClient()
    
    # Check server health
    health = client.health_check()
    
    # Send training results
    client.report_training_result(accuracy=0.95, loss=0.05, method="peep")
"""

import os
import requests
from typing import Optional, Any


class ServerClient:
    """Client for communicating with the Express/tRPC server."""
    
    def __init__(self, base_url: Optional[str] = None):
        """
        Initialize the server client.
        
        Args:
            base_url: Base URL of the Express server. 
                      Defaults to EXPRESS_BASE_URL env var or http://localhost:4000
        """
        self.base_url = base_url or os.environ.get("EXPRESS_BASE_URL", "http://localhost:4000")
        self.session = requests.Session()
        self.session.headers.update({
            "Content-Type": "application/json",
        })
    
    def health_check(self) -> dict:
        """Check if the server is healthy."""
        try:
            response = self.session.get(f"{self.base_url}/trpc/health.root")
            response.raise_for_status()
            return {"ok": True, "status": response.status_code, "data": response.json()}
        except requests.RequestException as e:
            return {"ok": False, "error": str(e)}
    
    def _trpc_query(self, path: str, input_data: Optional[dict] = None) -> dict:
        """Make a tRPC query request."""
        try:
            url = f"{self.base_url}/trpc/{path}"
            if input_data:
                import json
                url += f"?input={requests.utils.quote(json.dumps(input_data))}"
            response = self.session.get(url)
            response.raise_for_status()
            return {"ok": True, "data": response.json()}
        except requests.RequestException as e:
            return {"ok": False, "error": str(e)}
    
    def _trpc_mutation(self, path: str, input_data: dict) -> dict:
        """Make a tRPC mutation request."""
        try:
            url = f"{self.base_url}/trpc/{path}"
            response = self.session.post(url, json=input_data)
            response.raise_for_status()
            return {"ok": True, "data": response.json()}
        except requests.RequestException as e:
            return {"ok": False, "error": str(e)}
    
    def get_server_status(self) -> dict:
        """Get detailed server status."""
        return self._trpc_query("health.status")


# Convenience function for quick health checks
def check_server_connection(base_url: Optional[str] = None) -> bool:
    """
    Quick check if the server is reachable.
    
    Args:
        base_url: Optional base URL override
        
    Returns:
        True if server is reachable, False otherwise
    """
    client = ServerClient(base_url)
    result = client.health_check()
    return result.get("ok", False)
