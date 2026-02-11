const path = require("path");
const HtmlWebpackPlugin = require("html-webpack-plugin");

module.exports = (env, argv) => {
  const isProduction = argv.mode === "production";

  return {
    entry: "./src/index.tsx",
    output: {
      path: path.resolve(__dirname, "../dist"),
      filename: "bundle.js",
      publicPath: isProduction ? "/E-BOARD/" : "/"
    },
    devtool: "source-map",
    resolve: {
      extensions: [".tsx", ".ts", ".js", ".less"],
      alias: {
        "@e-board/board-ui": path.resolve(__dirname, "../packages/board-ui/src"),
        "@e-board/board-utils": path.resolve(__dirname, "../packages/board-utils/src"),
        "@e-board/board-core": path.resolve(__dirname, "../packages/board-core/src"),
        "@e-board/board-workbench": path.resolve(__dirname, "../packages/board-workbench/src"),
        "@e-board/board-plugin-fps": path.resolve(__dirname, "../packages/board-plugin-fps/src"),
        "@e-board/board-websocket": path.resolve(__dirname, "../packages/board-websocket"),
        "@e-board/board-collaboration": path.resolve(
          __dirname,
          "../packages/board-collaboration/src"
        )
      }
    },
    module: {
      rules: [
        {
          test: /\.(ts|tsx)$/,
          exclude: /node_modules/,
          use: {
            loader: "babel-loader",
            options: {
              presets: [
                "@babel/preset-env",
                [
                  "@babel/preset-react",
                  {
                    runtime: "automatic"
                  }
                ],
                [
                  "@babel/preset-typescript",
                  {
                    isTSX: true,
                    allExtensions: true
                  }
                ]
              ],
              sourceMaps: true
            }
          }
        },
        {
          test: /\.css$/,
          use: [
            "style-loader",
            {
              loader: "css-loader",
              options: {
                sourceMap: true
              }
            }
          ]
        },
        {
          test: /\.less$/,
          use: [
            "style-loader",
            {
              loader: "css-loader",
              options: {
                modules: {
                  localIdentName: "[name]__[local]--[hash:base64:5]"
                },
                sourceMap: true
              }
            },
            {
              loader: "less-loader",
              options: {
                sourceMap: true
              }
            }
          ]
        }
      ]
    },
    plugins: [
      new HtmlWebpackPlugin({
        template: "./public/index.html"
      })
    ],
    devServer: {
      static: {
        directory: path.join(__dirname, "public")
      },
      port: 3001,
      hot: true
    }
  };
};
