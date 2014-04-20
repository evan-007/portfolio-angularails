class AddLedeToProjects < ActiveRecord::Migration
  def change
    add_column :projects, :lede, :string
  end
end
