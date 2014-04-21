source 'https://rubygems.org'

# Bundle edge Rails instead: gem 'rails', github: 'rails/rails'
gem 'rails', '4.0.2'

# Use sqlite3 as the database for Active Record

gem 'angularjs-rails'
gem 'ngmin-rails'

gem 'rails_12factor'

gem 'devise'

#s3 image uploads, config.yml!
gem "paperclip", "~> 4.1"
gem 'aws-sdk', '~> 1.5.7'

# Use SCSS for stylesheets
gem 'sass-rails', '~> 4.0.0'

# Use Uglifier as compressor for JavaScript assets
gem 'uglifier', '>= 1.3.0'

# Use CoffeeScript for .js.coffee assets and views
gem 'coffee-rails', '~> 4.0.0'

# See https://github.com/sstephenson/execjs#readme for more supported runtimes
# gem 'therubyracer', platforms: :ruby

# Use jquery as the JavaScript library
gem 'jquery-rails'

# Turbolinks makes following links in your web application faster. Read more: https://github.com/rails/turbolinks
gem 'active_model_serializers'


# Build JSON APIs with ease. Read more: https://github.com/rails/jbuilder

group :doc do
  # bundle exec rake doc:rails generates the API under doc/api.
  gem 'sdoc', require: false
end

group :test, :development do
	gem 'sqlite3'
	gem 'rspec-rails'
end

group :production do
	gem 'pg'
end

#deploy
gem 'capistrano', '~> 3.0.1'
gem 'capistrano-rails', '~> 1.1.0'
gem 'capistrano-bundler'
gem 'capistrano-rbenv', '~> 2.0'
gem 'unicorn'