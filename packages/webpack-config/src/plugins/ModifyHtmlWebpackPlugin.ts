import { Compiler, Plugin, compilation } from 'webpack';

function maybeFetchPlugin(compiler: Compiler, name: string): Plugin | undefined {
  return compiler.options?.plugins
    ?.map(({ constructor }) => constructor)
    .find(constructor => constructor && constructor.name === name);
}

export default class ModifyHtmlWebpackPlugin {
  constructor(private modifyOptions: { inject?: boolean | Function } = {}) {}

  async modifyAsync(
    compiler: Compiler,
    compilation: compilation.Compilation,
    data: any
  ): Promise<any> {
    return data;
  }

  apply(compiler: Compiler) {
    compiler.hooks.make.tapPromise(
      this.constructor.name,
      async (compilation: compilation.Compilation) => {
        // Hook into the html-webpack-plugin processing and add the html
        const HtmlWebpackPlugin = maybeFetchPlugin(compiler, 'HtmlWebpackPlugin') as any;
        if (HtmlWebpackPlugin) {
          if (typeof HtmlWebpackPlugin.getHooks === 'undefined') {
            compilation.errors.push(
              new Error(
                'ModifyHtmlWebpackPlugin - This ModifyHtmlWebpackPlugin version is not compatible with your current HtmlWebpackPlugin version.\n'
              )
            );
            return;
          }

          HtmlWebpackPlugin.getHooks(compilation).alterAssetTags.tapAsync(
            this.constructor.name,
            async (data: any, htmlCallback: (error: Error | null, data: any) => void) => {
              // Skip if a custom injectFunction returns false or if
              // the htmlWebpackPlugin optuons includes a `favicons: false` flag
              const isInjectionAllowed =
                typeof this.modifyOptions.inject === 'function'
                  ? this.modifyOptions.inject(data.plugin)
                  : data.plugin.options.pwaManifest !== false;

              if (isInjectionAllowed === false) {
                return htmlCallback(null, data);
              }

              try {
                data = await this.modifyAsync(compiler, compilation, data);
              } catch (error) {
                compilation.errors.push(error);
              }

              htmlCallback(null, data);
            }
          );
        }
      }
    );
  }
}