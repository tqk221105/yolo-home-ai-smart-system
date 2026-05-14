import os
from flask import Flask
from flask_cors import CORS
from dotenv import load_dotenv
from routes.feeds import feeds_bp
from routes.ai import ai_bp
from routes.security import security_bp

load_dotenv()

app = Flask(__name__)
CORS(app)

app.register_blueprint(feeds_bp, url_prefix="/api")
app.register_blueprint(ai_bp, url_prefix="/api")
app.register_blueprint(security_bp, url_prefix="/api")

if __name__ == "__main__":
    port = int(os.getenv("FLASK_PORT", 5000))
    host = os.getenv("FLASK_HOST", "0.0.0.0")
    app.run(debug=True, host=host, port=port)
