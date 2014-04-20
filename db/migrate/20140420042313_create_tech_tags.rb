class CreateTechTags < ActiveRecord::Migration
  def change
    create_table :tech_tags do |t|
      t.references :project, index: true
      t.references :tag, index: true

      t.timestamps
    end
  end
end
